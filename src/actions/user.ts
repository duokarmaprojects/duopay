"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const profileSchema = z.object({
  phone: z.string().min(10, "Phone number is too short").max(15, "Phone number is too long"),
  upiId: z.string().includes("@", { message: "Invalid UPI ID" }).min(5, "UPI ID is too short"),
})

export async function completeProfile(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Not authenticated")
  }

  const phone = formData.get("phone") as string
  const upiId = formData.get("upiId") as string

  const parsed = profileSchema.safeParse({ phone, upiId })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      phone: parsed.data.phone,
      upiId: parsed.data.upiId
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
    data: { upiId: newUpi }
  })

  revalidatePath('/profile')
}

import { writeFile } from "fs/promises"
import path from "path"

export async function uploadProfileImage(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const file = formData.get("image") as File
  if (!file || file.size === 0) {
    throw new Error("No file uploaded")
  }

  // Very basic validation
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image")
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Generate unique filename
  const ext = file.name.split('.').pop() || 'png'
  const filename = `avatar-${session.user.id}-${Date.now()}.${ext}`
  
  // Save to public/uploads
  const filepath = path.join(process.cwd(), "public", "uploads", filename)
  await writeFile(filepath, buffer)

  const publicUrl = `/uploads/${filename}`

  // Update user in DB
  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: publicUrl }
  })

  revalidatePath('/profile')
  revalidatePath('/')
}
