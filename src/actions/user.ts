"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { normalizePhoneNumber } from "@/domain/phone"

const profileSchema = z.object({
  phone: z.string().min(10, "Phone number is too short").max(20, "Phone number is too long"),
  upiId: z.string().includes("@", { message: "Invalid UPI ID" }).min(5, "UPI ID is too short"),
})

export async function completeProfile(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Not authenticated")
  }

  const rawPhone = formData.get("phone") as string
  const upiId = formData.get("upiId") as string

  const parsed = profileSchema.safeParse({ phone: rawPhone, upiId })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const phone = normalizePhoneNumber(parsed.data.phone) || parsed.data.phone.trim()

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      phone,
      upiId: parsed.data.upiId.trim()
    }
  })

  redirect('/')
}

export async function updateUpiId(newUpi: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  if (!newUpi.includes("@") || newUpi.length < 5) {
    throw new Error("Invalid UPI ID")
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { upiId: newUpi.trim() }
  })

  revalidatePath('/profile')
}

export async function uploadProfileImage(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const dataUrl = formData.get("dataUrl") as string | null
  const file = formData.get("image") as File | null

  let finalImageUrl: string = ""

  if (dataUrl && dataUrl.startsWith("data:image/")) {
    // Validate size (max 500KB for base64)
    if (dataUrl.length > 500 * 1024) {
      throw new Error("Image too large. Please select a smaller photo.")
    }
    finalImageUrl = dataUrl
  } else if (file && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      throw new Error("File must be an image (JPEG, PNG, or WebP)")
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new Error("Image exceeds 8MB limit")
    }
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString("base64")
    finalImageUrl = `data:${file.type};base64,${base64}`
  } else {
    throw new Error("No image data provided")
  }

  // Update user in DB
  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: finalImageUrl }
  })

  revalidatePath('/profile')
  revalidatePath('/')
  return { success: true, imageUrl: finalImageUrl }
}

export async function matchContacts(contacts: Array<{ name: string; tel: string }>) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return { registered: [], unregistered: [] }
  }

  // Deduplicate and normalize phone numbers (up to 50 for privacy and performance)
  const normalizedMap = new Map<string, string>()
  for (const c of contacts.slice(0, 50)) {
    const norm = normalizePhoneNumber(c.tel)
    if (norm && !normalizedMap.has(norm)) {
      normalizedMap.set(norm, c.name || "Contact")
    }
  }

  const phoneNumbers = Array.from(normalizedMap.keys())
  if (phoneNumbers.length === 0) {
    return { registered: [], unregistered: [] }
  }

  // Query database for matching users
  const matchedUsers = await prisma.user.findMany({
    where: {
      phone: { in: phoneNumbers }
    },
    select: {
      id: true,
      name: true,
      phone: true,
      image: true,
      upiId: true
    }
  })

  const matchedPhoneSet = new Set(matchedUsers.map(u => u.phone))

  const registered = matchedUsers.map(u => ({
    id: u.id,
    name: u.name || normalizedMap.get(u.phone!) || "DuoPay User",
    phone: u.phone!,
    image: u.image,
    upiId: u.upiId,
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
