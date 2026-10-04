"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { logSecurityEvent } from "@/lib/securityAudit"
import { validateId, sanitizeTextInput } from "@/lib/security"
import { getReceiptExtractor, generateFingerprint } from "@/receipt/extractReceipt"
import { ExtractedReceiptV2 } from "@/receipt/receiptTypes"
import { addExpense } from "@/actions/expense"
import { revalidatePath } from "next/cache"
import { validateImageMagicBytes } from "@/domain/receipt"

const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]

export async function createReceiptScan(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "createReceiptScan" },
    })
    throw new Error("Unauthorized")
  }

  const userId = session.user.id

  const rateLimit = checkActionRateLimit("EXPENSE_CREATION", userId)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId,
      details: { action: "createReceiptScan" },
    })
    throw new Error("Rate limit exceeded. Please wait a moment.")
  }

  const file = formData.get("receipt") as File | null
  const source = (formData.get("source") as string) || "UPLOAD"
  const idempotencyKey = (formData.get("idempotencyKey") as string) || null

  if (!file) {
    throw new Error("Receipt image file is required")
  }

  if (file.size > MAX_IMAGE_SIZE) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId,
      details: { action: "receipt_file_too_large", size: file.size },
    })
    throw new Error("File exceeds maximum allowed size of 10MB")
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId,
      details: { action: "receipt_invalid_mime", mime: file.type },
    })
    throw new Error(`Invalid file type: ${file.type}. Supported formats: JPEG, PNG, WEBP`)
  }

  const arrayBuffer = await file.arrayBuffer()
  const isValidMagic = validateImageMagicBytes(arrayBuffer, file.type)
  if (!isValidMagic) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId,
      details: { action: "receipt_magic_bytes_mismatch", mime: file.type },
    })
    throw new Error("Invalid image header: file content does not match reported MIME type")
  }

  const fingerprint = await generateFingerprint(arrayBuffer)

  // 48h duplicate detection: advisory flag for user
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const existingScan = await prisma.receiptScan.findFirst({
    where: {
      userId,
      fingerprint,
      createdAt: { gte: twoDaysAgo },
      status: { in: ["NEEDS_REVIEW", "CONFIRMED"] },
    },
    orderBy: { createdAt: "desc" },
  })

  if (existingScan && existingScan.status === "NEEDS_REVIEW") {
    return {
      success: true,
      scanId: existingScan.id,
      isDuplicate: true,
      extractedData: existingScan.extractedData ? JSON.parse(existingScan.extractedData) : null,
      status: existingScan.status,
    }
  }

  // Extract metadata via OCR engine
  const extractor = getReceiptExtractor()
  const mode = source === "SCREENSHOT" ? "screenshot" : "scan"
  const extractedData = await extractor.extract(file, mode)

  const scan = await prisma.receiptScan.create({
    data: {
      userId,
      status: "NEEDS_REVIEW",
      imageMimeType: file.type,
      imageSizeBytes: file.size,
      extractedData: JSON.stringify(extractedData),
      fingerprint,
      idempotencyKey,
      source,
    },
  })

  return {
    success: true,
    scanId: scan.id,
    isDuplicate: Boolean(existingScan),
    extractedData,
    status: scan.status,
  }
}

export async function getReceiptScan(scanId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  const userId = session.user.id

  validateId(scanId, "scanId")

  const scan = await prisma.receiptScan.findUnique({
    where: { id: scanId },
  })

  if (!scan) {
    throw new Error("Receipt scan not found")
  }

  // IDOR protection: scan owner isolation
  if (scan.userId !== userId) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "getReceiptScan_unauthorized_owner", scanId },
    })
    throw new Error("Unauthorized: You do not have access to this receipt scan")
  }

  return {
    ...scan,
    extractedData: scan.extractedData ? (JSON.parse(scan.extractedData) as ExtractedReceiptV2) : null,
  }
}

export async function dismissReceiptScan(scanId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  validateId(scanId, "scanId")

  const scan = await prisma.receiptScan.findUnique({
    where: { id: scanId },
  })

  if (!scan) throw new Error("Receipt scan not found")

  if (scan.userId !== userId) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "dismissReceiptScan_owner_mismatch", scanId },
    })
    throw new Error("Unauthorized")
  }

  await prisma.receiptScan.update({
    where: { id: scanId },
    data: { status: "EXPIRED" },
  })

  return { success: true }
}

export async function confirmReceiptExpense(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "confirmReceiptExpense" },
    })
    throw new Error("Unauthorized")
  }
  const userId = session.user.id

  const scanId = formData.get("scanId") as string
  if (!scanId) {
    throw new Error("Scan ID is required")
  }
  validateId(scanId, "scanId")

  const scan = await prisma.receiptScan.findUnique({
    where: { id: scanId },
  })

  if (!scan) throw new Error("Receipt scan not found")

  // IDOR Check
  if (scan.userId !== userId) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "confirmReceiptExpense_owner_mismatch", scanId },
    })
    throw new Error("Unauthorized: You do not own this receipt scan")
  }

  // Ensure state is NEEDS_REVIEW
  if (scan.status === "CONFIRMED") {
    throw new Error("This receipt scan has already been confirmed as an expense")
  }
  if (scan.status !== "NEEDS_REVIEW") {
    throw new Error(`Receipt scan in ${scan.status} state cannot be confirmed`)
  }

  // Remove scanId from formData before delegating to addExpense
  formData.delete("scanId")
  // Ensure source is tagged as RECEIPT or SCREENSHOT
  if (!formData.has("source")) {
    formData.set("source", scan.source === "SCREENSHOT" ? "SCREENSHOT" : "RECEIPT")
  }

  // Atomically mark status as CONFIRMED to prevent concurrent duplicates
  const transition = await prisma.receiptScan.updateMany({
    where: { id: scanId, status: "NEEDS_REVIEW" },
    data: { status: "CONFIRMED" },
  })

  if (transition.count === 0) {
    throw new Error("This receipt scan has already been confirmed as an expense")
  }

  try {
    // Call the authoritative addExpense server action
    await addExpense(formData)
  } catch (err: any) {
    if (err?.message?.includes("NEXT_REDIRECT")) {
      revalidatePath("/expenses/add")
      revalidatePath("/receipt")
      return { success: true }
    }
    // Revert status on failure
    await prisma.receiptScan.update({
      where: { id: scanId },
      data: { status: "NEEDS_REVIEW" },
    })
    throw err
  }

  revalidatePath("/expenses/add")
  revalidatePath("/receipt")
  return { success: true }
}
