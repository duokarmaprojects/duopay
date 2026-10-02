"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { 
  calculateEqualSplit, 
  calculatePercentageSplit,
  calculateExactSplit,
  calculateSharesSplit,
  inrToPaise 
} from "@/domain/money"

const addExpenseSchema = z.object({
  groupId: z.string().min(1),
  description: z.string().min(1, "Description required"),
  amount: z.number().positive("Amount must be positive"),
  payerId: z.string().min(1),
  participantIds: z.array(z.string()).min(1, "At least one participant required"),
  splitMethod: z.enum(["EQUAL", "PERCENTAGE", "EXACT", "SHARES"]).default("EQUAL"),
  splitData: z.string().optional(), // JSON string of Record<string, number>
  category: z.string().optional()
})

export async function addExpense(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const groupId = formData.get("groupId") as string
  const description = formData.get("description") as string
  const amountInr = parseFloat(formData.get("amount") as string)
  const payerId = formData.get("payerId") as string
  const participantIds = formData.getAll("participants") as string[]
  const splitMethod = (formData.get("splitMethod") as string || "EQUAL") as "EQUAL" | "PERCENTAGE" | "EXACT" | "SHARES"
  const splitDataStr = formData.get("splitData") as string || "{}"
  const category = formData.get("category") as string || "OTHER"

  const parsed = addExpenseSchema.safeParse({
    groupId,
    description,
    amount: amountInr,
    payerId,
    participantIds,
    splitMethod,
    splitData: splitDataStr,
    category
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { data } = parsed
  const amountPaise = inrToPaise(data.amount)

  // Validate group access
  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: data.groupId, userId: session.user.id } }
  })
  if (!isMember) throw new Error("Unauthorized access to group")

  // Parse split data
  let splitDataObj: Record<string, number> = {}
  try {
    splitDataObj = JSON.parse(data.splitData || "{}")
  } catch (e) {
    throw new Error("Invalid split data format")
  }

  // Calculate split
  let shares: Record<string, number>
  try {
    if (data.splitMethod === "PERCENTAGE") {
      shares = calculatePercentageSplit(amountPaise, splitDataObj)
    } else if (data.splitMethod === "EXACT") {
      shares = calculateExactSplit(amountPaise, splitDataObj)
    } else if (data.splitMethod === "SHARES") {
      shares = calculateSharesSplit(amountPaise, splitDataObj)
    } else {
      shares = calculateEqualSplit(amountPaise, data.participantIds)
    }
    
    // Ensure all participants exist in the shares output and non-participants are ignored
    // (Our domain functions guarantee safety but this ensures alignment with participantIds)
    for (const pid of data.participantIds) {
      if (!(pid in shares)) {
         throw new Error(`Participant ${pid} is missing a computed share`)
      }
    }
  } catch (e: any) {
    throw new Error(e.message)
  }

  // Create Expense and Participants transactionally
  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        groupId: data.groupId,
        description: data.description,
        amount: amountPaise,
        payerId: data.payerId,
        splitMethod: data.splitMethod,
        category: data.category
      }
    })

    const participantsData = data.participantIds.map(userId => ({
      expenseId: expense.id,
      userId: userId,
      share: shares[userId]
    }))

    await tx.expenseParticipant.createMany({
      data: participantsData
    })
  })

  revalidatePath(`/groups/${data.groupId}`)
  revalidatePath('/')
  redirect(`/groups/${data.groupId}`)
}

export async function deleteExpense(expenseId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Find expense to verify access
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      group: {
        include: {
          members: true
        }
      }
    }
  })

  if (!expense) throw new Error("Expense not found")

  // Only allow deletion if user is a member of the group
  const isMember = expense.group?.members.some(m => m.userId === session.user?.id)
  
  if (!isMember) {
    throw new Error("Unauthorized to delete this expense")
  }

  // Delete transactionally
  await prisma.$transaction(async (tx) => {
    // Delete participants first due to foreign key
    await tx.expenseParticipant.deleteMany({
      where: { expenseId }
    })
    
    // Delete expense
    await tx.expense.delete({
      where: { id: expenseId }
    })
  })

  revalidatePath(`/groups/${expense.groupId}`)
  revalidatePath('/')
  revalidatePath('/activity')
}
