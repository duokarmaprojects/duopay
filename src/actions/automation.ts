"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const automationRuleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  merchantName: z.string().optional().nullable(),
  minAmount: z.number().nonnegative().optional().nullable(), // in paise
  maxAmount: z.number().nonnegative().optional().nullable(), // in paise
  source: z.string().optional().nullable(),
  groupId: z.string().optional().nullable(),
  setCategory: z.string().min(1, "Category is required"),
  priority: z.number().default(0),
  isActive: z.boolean().default(true),
})

export async function getUserRules() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  return await prisma.automationRule.findMany({
    where: { userId: session.user.id },
    orderBy: { priority: "desc" },
  })
}

export async function createRule(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const data = Object.fromEntries(formData.entries())
  
  const parsed = automationRuleSchema.safeParse({
    name: data.name,
    merchantName: data.merchantName || null,
    minAmount: data.minAmount ? parseInt(data.minAmount as string, 10) : null,
    maxAmount: data.maxAmount ? parseInt(data.maxAmount as string, 10) : null,
    source: data.source || null,
    groupId: data.groupId || null,
    setCategory: data.setCategory,
    priority: data.priority ? parseInt(data.priority as string, 10) : 0,
    isActive: data.isActive === "true" || data.isActive === "on" || (data.isActive as any) === true,
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  await prisma.automationRule.create({
    data: {
      userId: session.user.id,
      ...parsed.data,
    },
  })

  revalidatePath("/settings/automations")
}

export async function updateRule(id: string, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const rule = await prisma.automationRule.findUnique({ where: { id } })
  if (!rule || rule.userId !== session.user.id) throw new Error("Rule not found or unauthorized")

  const data = Object.fromEntries(formData.entries())
  
  const parsed = automationRuleSchema.safeParse({
    name: data.name,
    merchantName: data.merchantName || null,
    minAmount: data.minAmount ? parseInt(data.minAmount as string, 10) : null,
    maxAmount: data.maxAmount ? parseInt(data.maxAmount as string, 10) : null,
    source: data.source || null,
    groupId: data.groupId || null,
    setCategory: data.setCategory,
    priority: data.priority ? parseInt(data.priority as string, 10) : rule.priority,
    isActive: data.isActive === "true" || data.isActive === "on" || (data.isActive as any) === true,
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  await prisma.automationRule.update({
    where: { id },
    data: parsed.data,
  })

  revalidatePath("/settings/automations")
}

export async function deleteRule(id: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const rule = await prisma.automationRule.findUnique({ where: { id } })
  if (!rule || rule.userId !== session.user.id) throw new Error("Rule not found or unauthorized")

  await prisma.automationRule.delete({
    where: { id },
  })

  revalidatePath("/settings/automations")
}
