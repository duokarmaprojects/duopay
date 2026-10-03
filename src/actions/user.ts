"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { normalizePhoneNumber } from "@/domain/phone"
import { validateUpiFormat } from "@/domain/upi"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { logSecurityEvent } from "@/lib/securityAudit"
import { sanitizeTextInput, validateImageSignature } from "@/lib/security"

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name is too long").optional(),
  phone: z.string().min(6, "Phone number is too short").max(20, "Phone number is too long"),
  upiId: z.string().min(5, "UPI ID is too short").max(70, "UPI ID is too long"),
}).strict()

export async function completeProfile(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "completeProfile" },
    })
    throw new Error("Not authenticated")
  }

  // Reject privileged role or balance injection attempts
  if (
    formData.has("role") ||
    formData.has("isAdmin") ||
    formData.has("cashbackBalancePaise") ||
    formData.has("cashback")
  ) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId: session.user.id,
      details: { action: "completeProfile_forbidden_field_injected" },
    })
    throw new Error("Client submission of privileged user or balance state is strictly prohibited")
  }

  const rawName = (formData.get("name") as string | null)?.trim()
  const rawPhone = formData.get("phone") as string
  const rawUpiId = formData.get("upiId") as string

  const parsed = profileSchema.safeParse({
    name: rawName ? sanitizeTextInput(rawName, 50) : undefined,
    phone: rawPhone,
    upiId: rawUpiId,
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const format = validateUpiFormat(parsed.data.upiId)
  if (!format.valid || !format.normalized) {
    throw new Error(format.error || "Invalid UPI ID format.")
  }

  const phone = normalizePhoneNumber(parsed.data.phone) || parsed.data.phone.trim()

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      phone,
      upiId: format.normalized,
    }
  })

  redirect('/')
}

export async function updateUpiId(newUpi: string) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "updateUpiId" },
    })
    throw new Error("Unauthorized")
  }

  const format = validateUpiFormat(newUpi)
  if (!format.valid || !format.normalized) {
    throw new Error(format.error || "Invalid UPI ID format.")
  }

  const normalized = format.normalized

  // Save the normalized UPI ID directly for the authenticated session user
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      upiId: normalized,
    }
  })

  revalidatePath('/profile')
  revalidatePath('/settle')
  revalidatePath('/')

  return {
    success: true,
    upiId: normalized,
  }
}

export async function uploadProfileImage(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const userId = session.user.id

  // Rate Limiting: max 5 image uploads / 5 mins
  const rateLimit = checkActionRateLimit("AVATAR_UPLOAD", userId)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId,
      details: { action: "uploadProfileImage" },
    })
    throw new Error("Too many upload attempts. Please wait a few minutes.")
  }

  const dataUrl = formData.get("dataUrl") as string | null
  const file = formData.get("image") as File | null

  let finalImageUrl = ""

  if (dataUrl && dataUrl.startsWith("data:image/")) {
    // Validate size (max 1MB for base64)
    if (dataUrl.length > 1024 * 1024) {
      throw new Error("Image too large. Maximum size is 1MB.")
    }

    const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
    if (!match) {
      throw new Error("Invalid image format.")
    }

    const buffer = Buffer.from(match[2], "base64")
    const sigCheck = validateImageSignature(buffer)
    if (!sigCheck.valid) {
      await logSecurityEvent({
        type: "MALICIOUS_INPUT_BLOCKED",
        userId,
        details: { action: "upload_invalid_signature" },
      })
      throw new Error(sigCheck.error || "Invalid file content. Only authentic JPEG, PNG, or WebP images are allowed.")
    }

    finalImageUrl = `data:${sigCheck.mimeType};base64,${match[2]}`
  } else if (file && file.size > 0) {
    if (file.size > 1024 * 1024) {
      throw new Error("Image exceeds 1MB limit. Please select a smaller photo.")
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const sigCheck = validateImageSignature(buffer)
    if (!sigCheck.valid) {
      await logSecurityEvent({
        type: "MALICIOUS_INPUT_BLOCKED",
        userId,
        details: { action: "upload_invalid_signature_file" },
      })
      throw new Error(sigCheck.error || "Invalid file content. Only authentic JPEG, PNG, or WebP images are allowed.")
    }

    const base64 = buffer.toString("base64")
    finalImageUrl = `data:${sigCheck.mimeType};base64,${base64}`
  } else {
    throw new Error("No image data provided")
  }

  // Update user in DB
  await prisma.user.update({
    where: { id: userId },
    data: { image: finalImageUrl }
  })

  revalidatePath('/profile')
  revalidatePath('/')
  return { success: true, imageUrl: `/api/users/${userId}/avatar` }
}

const contactSchema = z.array(
  z.object({
    name: z.string().max(100),
    tel: z.string().max(30),
  })
).max(50, "Maximum 50 contacts per match request")

export async function matchContacts(contacts: Array<{ name: string; tel: string }>) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const parsed = contactSchema.safeParse(contacts)
  if (!parsed.success || parsed.data.length === 0) {
    return { registered: [], unregistered: [] }
  }

  const normalizedMap = new Map<string, string>()
  for (const c of parsed.data) {
    const norm = normalizePhoneNumber(c.tel)
    if (norm && !normalizedMap.has(norm)) {
      normalizedMap.set(norm, sanitizeTextInput(c.name, 50) || "Contact")
    }
  }

  const phoneNumbers = Array.from(normalizedMap.keys())
  if (phoneNumbers.length === 0) {
    return { registered: [], unregistered: [] }
  }

  // Query database for matching users with safe projections and privacy enforcement
  const matchedUsers = await prisma.user.findMany({
    where: {
      phone: { in: phoneNumbers },
      OR: [
        { settings: null },
        { settings: { discoverableByPhone: true } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      image: true,
      upiId: true,
      settings: {
        select: {
          showUpiOnProfile: true,
        },
      },
    },
  })

  const matchedPhoneSet = new Set(matchedUsers.map(u => u.phone))

  const registered = matchedUsers.map(u => ({
    id: u.id,
    name: u.name || normalizedMap.get(u.phone!) || "DuoPay User",
    phone: u.phone!,
    image: u.image,
    upiId: u.settings?.showUpiOnProfile === false ? null : u.upiId,
    contactName: normalizedMap.get(u.phone!) || u.name || "Friend"
  }))

  const unregistered: Array<{ contactName: string; phone: string }> = []
  for (const [phone, name] of normalizedMap.entries()) {
    if (!matchedPhoneSet.has(phone)) {
      unregistered.push({ contactName: name, phone })
    }
  }

  return { registered, unregistered }
}
