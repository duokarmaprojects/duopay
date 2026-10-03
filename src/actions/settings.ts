"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { logSecurityEvent } from "@/lib/securityAudit"

import { defaultUserSettings, updateSettingsSchema, UpdateSettingsInput } from "@/domain/settings"

export type { UpdateSettingsInput }

export async function getUserSettings() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
  })

  if (!settings) {
    return { ...defaultUserSettings, userId: session.user.id }
  }

  return {
    userId: settings.userId,
    currency: settings.currency,
    defaultSplitMethod: settings.defaultSplitMethod as "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES",
    simplifyDebts: settings.simplifyDebts,
    expenseAlerts: settings.expenseAlerts,
    paymentReminders: settings.paymentReminders,
    groupActivityAlerts: settings.groupActivityAlerts,
    cashbackAlerts: (settings as any).cashbackAlerts ?? true,
    referralAlerts: (settings as any).referralAlerts ?? true,
    recurringReminders: (settings as any).recurringReminders ?? true,
    pushNotifications: settings.pushNotifications,
    discoverableByPhone: settings.discoverableByPhone,
    shareActivityInGroup: settings.shareActivityInGroup,
    showUpiOnProfile: settings.showUpiOnProfile,
  }
}

export async function updateUserSettings(input: UpdateSettingsInput) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "updateUserSettings" },
    })
    throw new Error("Unauthorized")
  }

  const userId = session.user.id

  const { userId: _claimedUserId, ...safeInput } = (input as any) || {}
  const parsed = updateSettingsSchema.safeParse(safeInput)
  if (!parsed.success) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId,
      details: { action: "updateUserSettings_invalid", errors: parsed.error.issues },
    })
    throw new Error(parsed.error.issues[0]?.message || "Invalid settings input")
  }

  const updated = await prisma.userSettings.upsert({
    where: { userId },
    update: parsed.data,
    create: {
      userId,
      ...defaultUserSettings,
      ...parsed.data,
    },
  })

  revalidatePath("/profile")
  revalidatePath("/")

  return {
    success: true,
    settings: {
      userId: updated.userId,
      currency: updated.currency,
      defaultSplitMethod: updated.defaultSplitMethod as "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES",
      simplifyDebts: updated.simplifyDebts,
      expenseAlerts: updated.expenseAlerts,
      paymentReminders: updated.paymentReminders,
      groupActivityAlerts: updated.groupActivityAlerts,
      cashbackAlerts: (updated as any).cashbackAlerts ?? true,
      referralAlerts: (updated as any).referralAlerts ?? true,
      recurringReminders: (updated as any).recurringReminders ?? true,
      pushNotifications: updated.pushNotifications,
      discoverableByPhone: updated.discoverableByPhone,
      shareActivityInGroup: updated.shareActivityInGroup,
      showUpiOnProfile: updated.showUpiOnProfile,
    },
  }
}
