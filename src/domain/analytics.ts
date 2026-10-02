import { prisma } from "@/lib/db"

export type AnalyticsEventType = 
  | "USER_SIGNED_UP"
  | "PROFILE_COMPLETED"
  | "GROUP_CREATED"
  | "GROUP_JOINED"
  | "EXPENSE_CREATED"
  | "EXPENSE_UPDATED"
  | "EXPENSE_DELETED"
  | "SMART_SPLIT_USED"
  | "RECEIPT_SCANNED"
  | "RECEIPT_SCAN_FAILED"
  | "SETTLEMENT_CREATED"
  | "UPI_INTENT_CREATED"

interface TrackEventParams {
  eventType: AnalyticsEventType
  userId?: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, any>
}

export async function trackEvent({
  eventType,
  userId,
  entityType,
  entityId,
  metadata
}: TrackEventParams) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        eventType,
        userId,
        entityType,
        entityId,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    })
  } catch (error) {
    console.error("Failed to track analytics event:", error)
  }
}

export async function trackSystemError(code: string, message: string, context?: any, stack?: string) {
  try {
    await prisma.systemError.create({
      data: {
        code,
        message,
        stack,
        context: context ? JSON.stringify(context) : null
      }
    })
  } catch (error) {
    console.error("Failed to track system error:", error)
  }
}
