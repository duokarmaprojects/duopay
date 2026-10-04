"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { logSecurityEvent } from "@/lib/securityAudit"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { sendNotification } from "@/services/notification"

const subscribePushSchema = z.object({
  endpoint: z.string().url("Valid URL required for push endpoint").max(1000),
  p256dh: z.string().min(10).max(256),
  auth: z.string().min(10).max(256),
  userAgent: z.string().max(500).optional().nullable(),
  platform: z.enum(["android", "ios", "desktop", "unknown"]).default("unknown"),
})

/**
 * Returns the public VAPID key to the client for push registration.
 * Safe to expose to the browser; VAPID_PRIVATE_KEY remains strictly secret server-side.
 */
export async function getVapidPublicKey(): Promise<{ publicKey: string | null; isSupported: boolean }> {
  const rawKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY)?.trim()
  const publicKey = rawKey ? rawKey.replace(/^['"]|['"]$/g, '') : null
  return {
    publicKey,
    isSupported: Boolean(publicKey),
  }
}

/**
 * Subscribes a device to Web Push for the authenticated user.
 * IDOR Prevention: userId is derived strictly from session.
 */
export async function subscribeToPush(input: unknown) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "subscribeToPush" },
    })
    throw new Error("Unauthorized")
  }

  const userId = session.user.id

  const rateLimit = checkActionRateLimit("PROFILE_UPDATE", userId)
  if (!rateLimit.allowed) {
    throw new Error("Too many subscription requests. Please try again in a moment.")
  }

  // Reject any client attempting to submit a spoofed userId
  if (input && typeof input === "object" && "userId" in input && (input as any).userId !== userId) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "subscribeToPush_spoofed_userId" },
    })
    throw new Error("Unauthorized")
  }

  const parsed = subscribePushSchema.safeParse(input)
  if (!parsed.success) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId,
      details: { action: "subscribeToPush_invalid", errors: parsed.error.issues },
    })
    throw new Error(parsed.error.issues[0]?.message || "Invalid push subscription data")
  }

  const { endpoint, p256dh, auth: authSecret, userAgent, platform } = parsed.data

  // Upsert subscription: one user can have multiple devices (Android, iPhone, Desktop)
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId,
      p256dh,
      auth: authSecret,
      userAgent: userAgent || undefined,
      platform,
      isActive: true,
      lastUsedAt: new Date(),
    },
    create: {
      userId,
      endpoint,
      p256dh,
      auth: authSecret,
      userAgent: userAgent || undefined,
      platform,
      isActive: true,
    },
  })

  // Ensure pushNotifications setting is enabled
  await prisma.userSettings.upsert({
    where: { userId },
    update: { pushNotifications: true },
    create: { userId, pushNotifications: true },
  })

  await logSecurityEvent({
    type: "PUSH_SUBSCRIPTION_CHANGED",
    userId,
    details: { action: "push_subscribed", platform },
  })

  revalidatePath("/profile")
  return { success: true }
}

/**
 * Unsubscribes a specific device from push notifications.
 * Preserves other devices belonging to the same user.
 */
export async function unsubscribeFromPush(endpoint: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  if (!endpoint || typeof endpoint !== "string") {
    throw new Error("Valid endpoint required")
  }

  const userId = session.user.id

  // Only delete if the subscription belongs to the authenticated user (prevents IDOR deletion)
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint },
    select: { userId: true },
  })

  if (existing && existing.userId === userId) {
    await prisma.pushSubscription.delete({
      where: { endpoint },
    })
  }

  // Check if user has any remaining active subscriptions
  const remainingCount = await prisma.pushSubscription.count({
    where: { userId, isActive: true },
  })

  if (remainingCount === 0) {
    await prisma.userSettings.update({
      where: { userId },
      data: { pushNotifications: false },
    }).catch(() => {})
  }

  revalidatePath("/profile")
  return { success: true }
}

/**
 * Fetch notifications for the authenticated session user.
 */
export async function getUserNotifications(limit = 30) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const userId = session.user.id
  const clampedLimit = Math.min(Math.max(1, limit), 100)

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: clampedLimit,
    }),
    prisma.notification.count({
      where: { userId, readAt: null },
    }),
  ])

  return {
    notifications,
    unreadCount,
  }
}

/**
 * Marks a specific notification as read (scoped strictly to session user).
 */
export async function markNotificationAsRead(notificationId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const userId = session.user.id

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true },
  })

  if (!notification || notification.userId !== userId) {
    throw new Error("Notification not found")
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  })

  revalidatePath("/notifications")
  return { success: true }
}

/**
 * Marks all notifications for the current authenticated user as read.
 */
export async function markAllNotificationsAsRead() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const userId = session.user.id

  await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  })

  revalidatePath("/notifications")
  return { success: true }
}

/**
 * Send a test push notification to verify device setup.
 */
export async function sendTestNotification() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  return sendNotification({
    userId: session.user.id,
    type: "SYSTEM",
    title: "DuoPay Notifications Active",
    body: "You will now receive instant updates on expenses, settlements, and rewards.",
    url: "/profile",
  })
}
