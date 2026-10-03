import { describe, it, expect, vi, beforeEach } from "vitest"
import { sanitizeNotificationUrl } from "@/domain/notifications"
import { sendNotification } from "@/services/notification"
import {
  subscribeToPush,
  unsubscribeFromPush,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getVapidPublicKey,
} from "./notification"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import webpush from "web-push"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
  },
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    pushSubscription: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    userSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    analyticsEvent: {
      create: vi.fn().mockResolvedValue({ id: "evt-1" }),
    },
  },
}))

describe("PRODUCTION WEB PUSH & NOTIFICATIONS TEST SUITE", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: "user-alice" },
    } as any)
  })

  describe("1. Security: Open Redirect & URL Sanitization", () => {
    it("rejects protocol-relative double-slash URLs", () => {
      expect(sanitizeNotificationUrl("//evil.com")).toBe("/")
      expect(sanitizeNotificationUrl("//attacker.com/login")).toBe("/")
    })

    it("rejects absolute external URLs", () => {
      expect(sanitizeNotificationUrl("https://evil.com/phish")).toBe("/")
      expect(sanitizeNotificationUrl("http://evil.com")).toBe("/")
      expect(sanitizeNotificationUrl("javascript:alert(1)")).toBe("/")
      expect(sanitizeNotificationUrl("data:text/html,<script>alert(1)</script>")).toBe("/")
    })

    it("accepts valid internal application paths", () => {
      expect(sanitizeNotificationUrl("/")).toBe("/")
      expect(sanitizeNotificationUrl("/groups/group-123")).toBe("/groups/group-123")
      expect(sanitizeNotificationUrl("/rewards?tab=history")).toBe("/rewards?tab=history")
      expect(sanitizeNotificationUrl("/profile#settings")).toBe("/profile#settings")
    })

    it("falls back to / on null/undefined or empty input", () => {
      expect(sanitizeNotificationUrl(null)).toBe("/")
      expect(sanitizeNotificationUrl(undefined)).toBe("/")
      expect(sanitizeNotificationUrl("")).toBe("/")
    })
  })

  describe("2. Push Subscription Lifecycle & IDOR Protection", () => {
    it("rejects unauthenticated push subscription", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce(null)
      await expect(
        subscribeToPush({
          endpoint: "https://fcm.googleapis.com/fcm/send/sub-1",
          p256dh: "valid-key-p256dh-string-value",
          auth: "valid-auth-secret-string",
        })
      ).rejects.toThrow("Unauthorized")
    })

    it("rejects client submitting spoofed userId", async () => {
      await expect(
        subscribeToPush({
          userId: "victim-bob",
          endpoint: "https://fcm.googleapis.com/fcm/send/sub-1",
          p256dh: "valid-key-p256dh-string-value",
          auth: "valid-auth-secret-string",
        })
      ).rejects.toThrow("Unauthorized")
    })

    it("successfully subscribes authenticated user with valid payload", async () => {
      vi.mocked(prisma.pushSubscription.upsert).mockResolvedValueOnce({
        id: "sub-1",
        userId: "user-alice",
        endpoint: "https://fcm.googleapis.com/fcm/send/sub-1",
      } as any)
      vi.mocked(prisma.userSettings.upsert).mockResolvedValueOnce({} as any)

      const res = await subscribeToPush({
        endpoint: "https://fcm.googleapis.com/fcm/send/sub-1",
        p256dh: "valid-key-p256dh-string-value",
        auth: "valid-auth-secret-string",
        platform: "android",
      })

      expect(res.success).toBe(true)
      expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { endpoint: "https://fcm.googleapis.com/fcm/send/sub-1" },
          create: expect.objectContaining({
            userId: "user-alice",
            platform: "android",
          }),
        })
      )
    })

    it("unsubscribes only the calling device and preserves other devices for the user", async () => {
      vi.mocked(prisma.pushSubscription.findUnique).mockResolvedValueOnce({
        id: "sub-1",
        userId: "user-alice",
        endpoint: "https://fcm.googleapis.com/fcm/send/sub-phone",
      } as any)
      vi.mocked(prisma.pushSubscription.count).mockResolvedValueOnce(1) // Still has desktop subscription

      const res = await unsubscribeFromPush("https://fcm.googleapis.com/fcm/send/sub-phone")
      expect(res.success).toBe(true)
      expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({
        where: { endpoint: "https://fcm.googleapis.com/fcm/send/sub-phone" },
      })
      // Settings pushNotifications should not be turned off because another device is active
      expect(prisma.userSettings.update).not.toHaveBeenCalled()
    })

    it("prevents IDOR: user cannot delete another user's push subscription", async () => {
      vi.mocked(prisma.pushSubscription.findUnique).mockResolvedValueOnce({
        id: "sub-2",
        userId: "victim-bob",
        endpoint: "https://fcm.googleapis.com/fcm/send/sub-bob",
      } as any)

      await unsubscribeFromPush("https://fcm.googleapis.com/fcm/send/sub-bob")
      expect(prisma.pushSubscription.delete).not.toHaveBeenCalled()
    })
  })

  describe("3. Notification Service & Preference Filtering", () => {
    it("respects user notification preferences and suppresses push when category is disabled", async () => {
      vi.mocked(prisma.userSettings.findUnique).mockResolvedValueOnce({
        userId: "user-alice",
        expenseAlerts: false, // User turned off expense alerts
        pushNotifications: true,
      } as any)

      const result = await sendNotification({
        userId: "user-alice",
        type: "EXPENSE_ADDED",
        title: "Dinner Added",
        body: "Your share is ₹200",
        dedupKey: "test:unique-1",
      })

      expect(result.deliveredCount).toBe(0)
      expect(result.reason).toContain("disabled")
      expect(webpush.sendNotification).not.toHaveBeenCalled()
    })

    it("delivers push across multiple devices when preferences permit", async () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-pub-key"
      process.env.VAPID_PRIVATE_KEY = "test-priv-key"

      vi.mocked(prisma.userSettings.findUnique).mockResolvedValueOnce({
        userId: "user-alice",
        paymentReminders: true,
        pushNotifications: true,
      } as any)

      vi.mocked(prisma.pushSubscription.findMany).mockResolvedValueOnce([
        {
          id: "sub-phone",
          userId: "user-alice",
          endpoint: "https://fcm.googleapis.com/fcm/send/phone",
          p256dh: "key-1",
          auth: "auth-1",
          isActive: true,
        },
        {
          id: "sub-desktop",
          userId: "user-alice",
          endpoint: "https://updates.push.services.mozilla.com/wpush/v2/desktop",
          p256dh: "key-2",
          auth: "auth-2",
          isActive: true,
        },
      ] as any)

      const result = await sendNotification({
        userId: "user-alice",
        type: "PAYMENT_RECEIVED",
        title: "Payment Received",
        body: "Rahul paid you ₹500",
        url: "/settle",
        dedupKey: "test:unique-payment-1",
      })

      expect(result.success).toBe(true)
      expect(result.deliveredCount).toBe(2)
      expect(webpush.sendNotification).toHaveBeenCalledTimes(2)
    })

    it("automatically cleans up expired (404/410 Gone) subscriptions without breaking delivery", async () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-pub-key"
      process.env.VAPID_PRIVATE_KEY = "test-priv-key"

      vi.mocked(prisma.userSettings.findUnique).mockResolvedValueOnce({
        userId: "user-alice",
        cashbackAlerts: true,
        pushNotifications: true,
      } as any)

      vi.mocked(prisma.pushSubscription.findMany).mockResolvedValueOnce([
        {
          id: "sub-expired-device",
          userId: "user-alice",
          endpoint: "https://fcm.googleapis.com/fcm/send/expired",
          p256dh: "key-1",
          auth: "auth-1",
          isActive: true,
        },
        {
          id: "sub-active-device",
          userId: "user-alice",
          endpoint: "https://fcm.googleapis.com/fcm/send/active",
          p256dh: "key-2",
          auth: "auth-2",
          isActive: true,
        },
      ] as any)

      // First device returns 410 Gone
      vi.mocked(webpush.sendNotification)
        .mockRejectedValueOnce({ statusCode: 410, message: "Subscription expired" })
        .mockResolvedValueOnce({ statusCode: 201 } as any)

      const result = await sendNotification({
        userId: "user-alice",
        type: "CASHBACK_EARNED",
        title: "Cashback Earned!",
        body: "You earned ₹0.25",
        dedupKey: "test:unique-cashback-1",
      })

      expect(result.success).toBe(true)
      expect(result.deliveredCount).toBe(1)
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["sub-expired-device"] } },
      })
    })

    it("CRITICAL: Notification delivery failure NEVER crashes or rolls back financial state", async () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-pub-key"
      process.env.VAPID_PRIVATE_KEY = "test-priv-key"

      vi.mocked(prisma.userSettings.findUnique).mockRejectedValueOnce(
        new Error("Database connection glitch during notification check")
      )

      // Must catch internally and return success: false safely without throwing
      const result = await sendNotification({
        userId: "user-alice",
        type: "SETTLEMENT_COMPLETED",
        title: "Settlement",
        body: "Settled ₹100",
        dedupKey: "test:unique-financial-isolate",
      })

      expect(result.success).toBe(false)
      expect(result.deliveredCount).toBe(0)
    })

    it("durable DB idempotency: duplicate notification with same dedupKey is stopped by DB unique constraint", async () => {
      vi.mocked(prisma.userSettings.findUnique).mockResolvedValueOnce({
        userId: "user-alice",
        pushNotifications: true,
      } as any)

      // Simulate Prisma P2002 unique constraint violation on Notification dedupKey
      vi.mocked(prisma.notification.create).mockRejectedValueOnce({
        code: "P2002",
        message: "Unique constraint failed on the fields: (`dedupKey`)",
      })

      const result = await sendNotification({
        userId: "user-alice",
        type: "PAYMENT_SUCCESS",
        title: "Payment Successful",
        body: "Payment confirmed",
        dedupKey: "db-dedup-test-key-1",
      })

      expect(result.success).toBe(true)
      expect(result.deliveredCount).toBe(0)
      expect(result.reason).toBe("Deduplicated (DB)")
      expect(webpush.sendNotification).not.toHaveBeenCalled()
    })
  })

  describe("4. In-App Notification Center Access & Scoping", () => {
    it("scopes notification retrieval strictly to authenticated session user", async () => {
      vi.mocked(prisma.notification.findMany).mockResolvedValueOnce([
        {
          id: "notif-1",
          userId: "user-alice",
          title: "Payment Received",
          body: "Rahul paid you ₹500",
          readAt: null,
          createdAt: new Date(),
        } as any,
      ])
      vi.mocked(prisma.notification.count).mockResolvedValueOnce(1)

      const res = await getUserNotifications()
      expect(res.unreadCount).toBe(1)
      expect(res.notifications).toHaveLength(1)
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-alice" },
        })
      )
    })

    it("prevents IDOR: user cannot mark another user's notification as read", async () => {
      vi.mocked(prisma.notification.findUnique).mockResolvedValueOnce({
        id: "notif-99",
        userId: "victim-bob",
      } as any)

      await expect(markNotificationAsRead("notif-99")).rejects.toThrow("Notification not found")
      expect(prisma.notification.update).not.toHaveBeenCalled()
    })

    it("allows user to mark all their own notifications as read", async () => {
      const res = await markAllNotificationsAsRead()
      expect(res.success).toBe(true)
      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-alice", readAt: null },
          data: expect.objectContaining({ readAt: expect.any(Date) }),
        })
      )
    })
  })
})
