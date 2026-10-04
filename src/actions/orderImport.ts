"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { logSecurityEvent } from "@/lib/securityAudit"
import { validateId, sanitizeTextInput } from "@/lib/security"
import { NormalizedOrder, reconcileOrder } from "@/domain/orderImport"
import { addExpense } from "@/actions/expense"
import { revalidatePath } from "next/cache"

export async function createOrderImport(
  order: NormalizedOrder,
  idempotencyKey?: string | null
) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "createOrderImport" },
    })
    throw new Error("Unauthorized")
  }
  const userId = session.user.id

  const rateLimit = checkActionRateLimit("EXPENSE_CREATION", userId)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId,
      details: { action: "createOrderImport" },
    })
    throw new Error("Rate limit exceeded. Please wait a moment.")
  }

  // Validate all amounts are non-negative integers
  const numericFields = [
    order.subtotalPaise,
    order.taxPaise,
    order.deliveryFeePaise,
    order.discountPaise,
    order.tipPaise,
    order.totalPaise,
  ]
  for (const n of numericFields) {
    if (typeof n !== "number" || isNaN(n) || n < 0 || !isFinite(n)) {
      await logSecurityEvent({
        type: "MALICIOUS_INPUT_BLOCKED",
        userId,
        details: { action: "createOrderImport_invalid_numeric", value: n },
      })
      throw new Error("All monetary amounts must be non-negative numbers")
    }
  }

  // Idempotency check
  if (idempotencyKey) {
    validateId(idempotencyKey, "idempotencyKey")
    const existing = await prisma.orderImport.findFirst({
      where: { userId, idempotencyKey },
    })
    if (existing) {
      return { success: true, importId: existing.id, isDuplicate: true }
    }
  }

  const cleanMerchant = sanitizeTextInput(order.merchant || "Order Import", 100)
  const cleanExternalId = order.externalOrderId ? sanitizeTextInput(order.externalOrderId, 64) : null

  const orderRecord = await prisma.orderImport.create({
    data: {
      userId,
      provider: order.provider,
      externalOrderId: cleanExternalId,
      merchant: cleanMerchant,
      orderDate: order.orderDate ? new Date(order.orderDate) : new Date(),
      currency: "INR",
      subtotalPaise: Math.round(order.subtotalPaise),
      taxPaise: Math.round(order.taxPaise),
      deliveryFeePaise: Math.round(order.deliveryFeePaise),
      discountPaise: Math.round(order.discountPaise),
      tipPaise: Math.round(order.tipPaise),
      totalPaise: Math.round(order.totalPaise),
      itemsJson: JSON.stringify(order.items || []),
      importSource: order.importSource || "MANUAL",
      status: "PENDING_REVIEW",
      idempotencyKey: idempotencyKey || null,
    },
  })

  return { success: true, importId: orderRecord.id, isDuplicate: false }
}

export async function getOrderImport(importId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  validateId(importId, "importId")

  const order = await prisma.orderImport.findUnique({
    where: { id: importId },
  })

  if (!order) throw new Error("Order import not found")

  // IDOR Protection: isolated to owner
  if (order.userId !== userId) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "getOrderImport_owner_mismatch", importId },
    })
    throw new Error("Unauthorized: You do not own this order import")
  }

  return {
    ...order,
    items: order.itemsJson ? JSON.parse(order.itemsJson) : [],
  }
}

export async function listUserOrderImports(status?: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  const where: any = { userId }
  if (status) {
    where.status = status
  }

  const imports = await prisma.orderImport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return imports.map((imp) => ({
    ...imp,
    items: imp.itemsJson ? JSON.parse(imp.itemsJson) : [],
  }))
}

export async function dismissOrderImport(importId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  validateId(importId, "importId")

  const order = await prisma.orderImport.findUnique({
    where: { id: importId },
  })

  if (!order) throw new Error("Order import not found")

  if (order.userId !== userId) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "dismissOrderImport_owner_mismatch", importId },
    })
    throw new Error("Unauthorized")
  }

  await prisma.orderImport.update({
    where: { id: importId },
    data: { status: "DISMISSED" },
  })

  revalidatePath("/orders")
  return { success: true }
}

export async function confirmOrderImport(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "confirmOrderImport" },
    })
    throw new Error("Unauthorized")
  }
  const userId = session.user.id

  const importId = formData.get("importId") as string
  if (!importId) throw new Error("Import ID is required")
  validateId(importId, "importId")

  const order = await prisma.orderImport.findUnique({
    where: { id: importId },
  })

  if (!order) throw new Error("Order import not found")

  // IDOR Protection
  if (order.userId !== userId) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "confirmOrderImport_owner_mismatch", importId },
    })
    throw new Error("Unauthorized: You do not own this order import")
  }

  if (order.status === "CONFIRMED") {
    throw new Error("This order import has already been confirmed as an expense")
  }
  if (order.status !== "PENDING_REVIEW") {
    throw new Error(`Order import in ${order.status} state cannot be confirmed`)
  }

  // Check reconciliation: if unbalanced, require explicit user acknowledgment
  const items = order.itemsJson ? JSON.parse(order.itemsJson) : []
  const normalized: NormalizedOrder = {
    provider: order.provider as any,
    externalOrderId: order.externalOrderId,
    merchant: order.merchant,
    orderDate: order.orderDate ? (order.orderDate instanceof Date ? order.orderDate.toISOString().split("T")[0] : String(order.orderDate).slice(0, 10)) : null,
    subtotalPaise: order.subtotalPaise ?? 0,
    taxPaise: order.taxPaise ?? 0,
    deliveryFeePaise: order.deliveryFeePaise ?? 0,
    discountPaise: order.discountPaise ?? 0,
    tipPaise: order.tipPaise ?? 0,
    totalPaise: order.totalPaise ?? 0,
    items,
    importSource: order.importSource as any,
  }

  const reconciliation = reconcileOrder(normalized)
  const acknowledgeWarning = formData.get("acknowledgeWarning") === "true"

  if (!reconciliation.isBalanced && !acknowledgeWarning) {
    throw new Error(`Reconciliation mismatch: ${reconciliation.warning}. Please acknowledge before confirming.`)
  }

  // Remove importId and acknowledgeWarning from formData before delegating to addExpense
  formData.delete("importId")
  formData.delete("acknowledgeWarning")

  // Ensure source is tagged as IMPORT
  if (!formData.has("source")) {
    formData.set("source", "IMPORT")
  }

  // Atomically mark status as CONFIRMED to prevent concurrent duplicates
  const transition = await prisma.orderImport.updateMany({
    where: { id: importId, status: "PENDING_REVIEW" },
    data: { status: "CONFIRMED" },
  })

  if (transition.count === 0) {
    throw new Error("This order import has already been confirmed as an expense")
  }

  try {
    // Forward to authoritative addExpense
    await addExpense(formData)
  } catch (err: any) {
    if (err?.message?.includes("NEXT_REDIRECT")) {
      revalidatePath("/orders")
      revalidatePath("/expenses/add")
      return { success: true }
    }
    // Revert status on failure
    await prisma.orderImport.update({
      where: { id: importId },
      data: { status: "PENDING_REVIEW" },
    })
    throw err
  }

  revalidatePath("/orders")
  revalidatePath("/expenses/add")
  return { success: true }
}
