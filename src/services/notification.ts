import webpush from "web-push"
import { prisma } from "@/lib/db"
import {
  NotificationType,
  SendPushNotificationOptions,
  sanitizeNotificationUrl,
} from "@/domain/notifications"
import { logSecurityEvent } from "@/lib/securityAudit"

// In-memory cache for recent notification deduplication (10 minute TTL)
const recentNotificationsCache = new Map<string, number>()
const DEDUP_TTL_MS = 10 * 60 * 1000

function cleanupDedupCache() {
  const now = Date.now()
  for (const [key, timestamp] of recentNotificationsCache.entries()) {
    if (now - timestamp > DEDUP_TTL_MS) {
      recentNotificationsCache.delete(key)
    }
  }
}

/**
 * Configure VAPID details if environment variables are provided.
 */
function getVapidDetails() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || "mailto:support@duopay.local"

  if (!publicKey || !privateKey) {
    return null
  }

  return { publicKey, privateKey, subject }
}

/**
 * Centralized, production-grade notification delivery service.
 * Isolates all push delivery errors: financial/payment transactions MUST NEVER fail
 * due to push delivery issues.
 */
export async function sendNotification(
  options: SendPushNotificationOptions
): Promise<{ success: boolean; deliveredCount: number; reason?: string }> {
  try {
    const { userId, type, title, body, data, dedupKey } = options
    const safeUrl = sanitizeNotificationUrl(options.url)

    // 1. Anti-spam / Deduplication check
    cleanupDedupCache()
    const finalDedupKey = dedupKey || `${userId}:${type}:${title}:${body}`
    if (recentNotificationsCache.has(finalDedupKey)) {
      return { success: true, deliveredCount: 0, reason: "Deduplicated" }
    }
    recentNotificationsCache.set(finalDedupKey, Date.now())

    // 2. Fetch user notification preferences
    let settings: any = null
    if (prisma.userSettings?.findUnique) {
      try {
        settings = await prisma.userSettings.findUnique({
          where: { userId },
        })
      } catch {
        settings = null
      }
    }

    // Check specific category permissions
    if (settings) {
      if (
        (type.startsWith("EXPENSE_") || type === "YOU_OWE" || type === "YOU_ARE_OWED") &&
        settings.expenseAlerts === false
      ) {
        return { success: false, deliveredCount: 0, reason: "Expense alerts disabled by user" }
      }
      if (
        (type.startsWith("PAYMENT_") || type.startsWith("SETTLEMENT_")) &&
        settings.paymentReminders === false
      ) {
        return { success: false, deliveredCount: 0, reason: "Payment alerts disabled by user" }
      }
      if (type.startsWith("GROUP_") && settings.groupActivityAlerts === false) {
        return { success: false, deliveredCount: 0, reason: "Group alerts disabled by user" }
      }
      if (
        (type.startsWith("CASHBACK_")) &&
        (settings as any).cashbackAlerts === false
      ) {
        return { success: false, deliveredCount: 0, reason: "Cashback alerts disabled by user" }
      }
      if (
        (type.startsWith("REFERRAL_")) &&
        (settings as any).referralAlerts === false
      ) {
        return { success: false, deliveredCount: 0, reason: "Referral alerts disabled by user" }
      }
      if (
        (type.startsWith("RECURRING_")) &&
        (settings as any).recurringReminders === false
      ) {
        return { success: false, deliveredCount: 0, reason: "Recurring reminders disabled by user" }
      }
    }

    // 3. Persist in-app Notification record
    if (prisma.notification) {
      try {
        await prisma.notification.create({
          data: {
            userId,
            type,
            title,
            body,
            url: safeUrl,
            metadata: data ? JSON.stringify(data) : null,
          },
        })
      } catch (err) {
        console.error("[NotificationService] In-app notification creation error:", err)
      }
    }

    // 4. Web Push delivery
    // If push is explicitly disabled in user preferences, skip Web Push delivery
    if (settings && settings.pushNotifications === false) {
      return { success: true, deliveredCount: 0, reason: "Push notifications disabled in settings" }
    }

    const vapid = getVapidDetails()
    if (!vapid) {
      // VAPID not configured in this environment (e.g., CI or preview build without secrets)
      return { success: true, deliveredCount: 0, reason: "VAPID keys not configured" }
    }

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)

    // Load active push subscriptions for this user across all their devices
    const subscriptions = prisma.pushSubscription
      ? await prisma.pushSubscription.findMany({
          where: {
            userId,
            isActive: true,
          },
        })
      : []

    if (subscriptions.length === 0) {
      return { success: true, deliveredCount: 0, reason: "No active push subscriptions" }
    }

    const payload = JSON.stringify({
      title,
      body,
      url: safeUrl,
      type,
      tag: `duopay-${type.toLowerCase()}-${Date.now()}`,
      data: data || {},
    })

    let deliveredCount = 0
    const deadSubscriptionIds: string[] = []

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscriptionObj = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          }

          await webpush.sendNotification(pushSubscriptionObj, payload, {
            TTL: 86400, // 24 hours
            urgency: "high",
          })

          deliveredCount++

          // Update last used timestamp asynchronously
          prisma.pushSubscription
            .update({
              where: { id: sub.id },
              data: { lastUsedAt: new Date() },
            })
            .catch(() => {})
        } catch (error: any) {
          const statusCode = error.statusCode
          // 404 Not Found or 410 Gone indicates subscription has expired or unsubscribed
          if (statusCode === 404 || statusCode === 410) {
            deadSubscriptionIds.push(sub.id)
          } else {
            console.warn(
              `[NotificationService] Delivery error for device ${sub.id} (code ${statusCode}):`,
              error.message
            )
          }
        }
      })
    )

    // Prune dead subscriptions in batch
    if (deadSubscriptionIds.length > 0) {
      try {
        await prisma.pushSubscription.deleteMany({
          where: { id: { in: deadSubscriptionIds } },
        })
      } catch (pruneErr) {
        console.error("[NotificationService] Error pruning dead subscriptions:", pruneErr)
      }
    }

    return { success: true, deliveredCount }
  } catch (outerErr: any) {
    // CRITICAL REQUIREMENT: Notification failure must NEVER bubble up to crash financial operations
    console.error("[NotificationService] Unexpected error sending notification:", outerErr)
    return { success: false, deliveredCount: 0, reason: outerErr.message }
  }
}
