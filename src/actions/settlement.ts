"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const recordSettlementSchema = z.object({
  receiverId: z.string().min(1),
  amount: z.number().positive(),
  groupId: z.string().optional()
})

export async function recordSettlement(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const receiverId = formData.get("receiverId") as string
  const amountPaise = parseInt(formData.get("amountPaise") as string, 10)
  const groupId = formData.get("groupId") as string | null

  if (!amountPaise || amountPaise <= 0) {
    throw new Error("Invalid amount")
  }

  // Idempotency / Duplicate check could be added here by passing a token from the client
  // But for V1, we'll create the settlement.
  
  await prisma.settlement.create({
    data: {
      payerId: session.user.id,
      receiverId,
      amount: amountPaise,
      groupId: groupId || null,
      status: "COMPLETED"
    }
  })

  revalidatePath('/')
  if (groupId) {
    revalidatePath(`/groups/${groupId}`)
    redirect(`/groups/${groupId}`)
  } else {
    redirect('/')
  }
}
