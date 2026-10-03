import { z } from "zod"

export const defaultUserSettings = {
  currency: "INR",
  defaultSplitMethod: "EQUAL" as const,
  simplifyDebts: true,
  expenseAlerts: true,
  paymentReminders: true,
  groupActivityAlerts: true,
  pushNotifications: false,
  discoverableByPhone: true,
  shareActivityInGroup: true,
  showUpiOnProfile: true,
}

export const updateSettingsSchema = z.object({
  currency: z.enum(["INR", "USD", "EUR", "GBP"]).optional(),
  defaultSplitMethod: z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"]).optional(),
  simplifyDebts: z.boolean().optional(),
  expenseAlerts: z.boolean().optional(),
  paymentReminders: z.boolean().optional(),
  groupActivityAlerts: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  discoverableByPhone: z.boolean().optional(),
  shareActivityInGroup: z.boolean().optional(),
  showUpiOnProfile: z.boolean().optional(),
})

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
