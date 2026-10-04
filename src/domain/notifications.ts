export type NotificationType =
  | "EXPENSE_ADDED"
  | "EXPENSE_UPDATED"
  | "EXPENSE_REMOVED"
  | "YOU_OWE"
  | "YOU_ARE_OWED"
  | "PAYMENT_INITIATED"
  | "PAYMENT_PENDING"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "PAYMENT_RECEIVED"
  | "SETTLEMENT_CREATED"
  | "SETTLEMENT_COMPLETED"
  | "GROUP_INVITE"
  | "GROUP_MEMBER_JOINED"
  | "GROUP_MEMBER_LEFT"
  | "CASHBACK_EARNED"
  | "CASHBACK_REDEEMED"
  | "REFERRAL_JOINED"
  | "REFERRAL_REWARD_EARNED"
  | "REFERRAL_MILESTONE_COMPLETED"
  | "RECURRING_EXPENSE_CREATED"
  | "RECURRING_EXPENSE_REMINDER"
  | "FRIEND_REQUEST_RECEIVED"
  | "FRIEND_REQUEST_ACCEPTED"
  | "EXPENSE_COMMENT"
  | "GROUP_MESSAGE"
  | "SYSTEM";

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  type: NotificationType;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

export interface SendPushNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
  /**
   * Optional idempotency/dedup key (e.g., "event:settle-123:received")
   * Prevents sending duplicate push notifications if the event is delivered multiple times.
   */
  dedupKey?: string;
}

/**
 * Validates that a target URL is a safe, same-origin relative DuoPay path.
 * Strictly prevents open-redirect attacks.
 */
export function sanitizeNotificationUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "/";
  }

  const trimmed = rawUrl.trim();

  // Must begin with a single slash and not double slash (protocol relative)
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }

  // Reject URLs containing javascript:, data:, vbscript:, or protocol schemes
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return "/";
  }

  // Parse path to ensure no traversal exploits
  try {
    const dummyOrigin = "https://duopay.local";
    const parsed = new URL(trimmed, dummyOrigin);
    if (parsed.origin !== dummyOrigin) {
      return "/";
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "/";
  }
}
