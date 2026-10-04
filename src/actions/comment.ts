"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { logSecurityEvent } from "@/lib/securityAudit"
import { validateId, sanitizeTextInput } from "@/lib/security"
import { pusherServer } from "@/lib/realtime/pusher"
import { sendNotification } from "@/services/notification"
import { revalidatePath } from "next/cache"

const MAX_COMMENT_LENGTH = 1000

export async function addExpenseComment(
  expenseId: string,
  rawBody: string,
  idempotencyKey?: string | null
) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "addExpenseComment" },
    })
    throw new Error("Unauthorized")
  }
  const userId = session.user.id

  validateId(expenseId, "expenseId")
  if (idempotencyKey) {
    validateId(idempotencyKey, "idempotencyKey")
  }

  // Rate Limiting
  const rateLimit = checkActionRateLimit("COMMENT_CREATION", userId)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId,
      details: { action: "addExpenseComment" },
    })
    throw new Error("Too many comments. Please wait a moment.")
  }

  if (!rawBody || !rawBody.trim()) {
    throw new Error("Comment text cannot be empty")
  }
  if (rawBody.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment exceeds maximum length of ${MAX_COMMENT_LENGTH} characters`)
  }

  const cleanBody = sanitizeTextInput(rawBody.trim(), MAX_COMMENT_LENGTH)

  // Load expense and verify access
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      group: {
        include: {
          members: true,
        },
      },
      participants: true,
    },
  })

  if (!expense) {
    throw new Error("Expense not found")
  }

  // IDOR Protection: User must belong to expense's group or be a direct participant
  let hasAccess = false
  if (expense.groupId && expense.group) {
    hasAccess = expense.group.members.some((m) => m.userId === userId)
  } else {
    hasAccess =
      expense.payerId === userId ||
      expense.participants.some((p) => p.userId === userId)
  }

  if (!hasAccess) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "addExpenseComment_unauthorized", expenseId },
    })
    throw new Error("Unauthorized: You do not have access to this expense")
  }

  // Idempotency check
  if (idempotencyKey) {
    const existing = await prisma.expenseComment.findFirst({
      where: {
        expenseId,
        idempotencyKey,
      },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
    })
    if (existing) {
      return { success: true, comment: existing, isDuplicate: true }
    }
  }

  let comment: any
  try {
    comment = await prisma.expenseComment.create({
      data: {
        expenseId,
        authorId: userId,
        body: cleanBody,
        idempotencyKey: idempotencyKey || null,
      },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
    })
  } catch (err: any) {
    if (
      idempotencyKey &&
      (err?.code === "P2002" ||
        String(err?.message || "").includes("UNIQUE") ||
        String(err?.message || "").includes("Duplicate") ||
        String(err?.message || "").includes("idempotencyKey"))
    ) {
      const existing = await prisma.expenseComment.findFirst({
        where: { expenseId, idempotencyKey },
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
      })
      if (existing) {
        return { success: true, comment: existing, isDuplicate: true }
      }
    }
    throw err
  }

  // Broadcast realtime event AFTER DB commit
  try {
    const payload = {
      id: comment.id,
      expenseId: comment.expenseId,
      authorId: comment.authorId,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      author: comment.author,
    }
    await pusherServer.trigger(`expense-${expenseId}`, "expense.comment_created", payload)
    if (expense.groupId) {
      await pusherServer.trigger(`group-${expense.groupId}`, "expense.comment_created", payload)
    }
  } catch (err) {}

  // Notify other participants in the expense
  const authorName = session.user.name || "Someone"
  const participantIds = expense.participants
    .map((p) => p.userId)
    .filter((pid) => pid !== userId)

  for (const pid of participantIds) {
    sendNotification({
      userId: pid,
      type: "EXPENSE_COMMENT",
      title: `${authorName} commented on ${expense.description}`,
      body: cleanBody.slice(0, 80),
      url: expense.groupId ? `/groups/${expense.groupId}` : `/activity`,
      data: { expenseId, commentId: comment.id },
    }).catch(() => {})
  }

  if (expense.groupId) {
    revalidatePath(`/groups/${expense.groupId}`)
  }
  return { success: true, comment, isDuplicate: false }
}

export async function getExpenseComments(expenseId: string, limit = 50) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  validateId(expenseId, "expenseId")

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      group: {
        include: {
          members: true,
        },
      },
      participants: true,
    },
  })

  if (!expense) throw new Error("Expense not found")

  let hasAccess = false
  if (expense.groupId && expense.group) {
    hasAccess = expense.group.members.some((m) => m.userId === userId)
  } else {
    hasAccess =
      expense.payerId === userId ||
      expense.participants.some((p) => p.userId === userId)
  }

  if (!hasAccess) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "getExpenseComments_unauthorized", expenseId },
    })
    throw new Error("Unauthorized")
  }

  const safeLimit = Math.min(Math.max(1, limit), 100)
  const comments = await prisma.expenseComment.findMany({
    where: {
      expenseId,
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
    take: safeLimit,
    include: {
      author: {
        select: { id: true, name: true, image: true },
      },
    },
  })

  return comments
}

export async function editExpenseComment(commentId: string, newBody: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  validateId(commentId, "commentId")

  if (!newBody || !newBody.trim()) {
    throw new Error("Comment text cannot be empty")
  }

  const comment = await prisma.expenseComment.findUnique({
    where: { id: commentId },
  })

  if (!comment) throw new Error("Comment not found")

  // IDOR Protection: only author can edit
  if (comment.authorId !== userId) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "editExpenseComment_unauthorized", commentId },
    })
    throw new Error("Unauthorized: You can only edit your own comments")
  }

  const cleanBody = sanitizeTextInput(newBody.trim(), MAX_COMMENT_LENGTH)

  const updated = await prisma.expenseComment.update({
    where: { id: commentId },
    data: { body: cleanBody },
    include: {
      author: {
        select: { id: true, name: true, image: true },
      },
    },
  })

  try {
    await pusherServer.trigger(`expense-${comment.expenseId}`, "expense.comment_updated", {
      id: updated.id,
      body: updated.body,
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (err) {}

  return { success: true, comment: updated }
}

export async function deleteExpenseComment(commentId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  validateId(commentId, "commentId")

  const comment = await prisma.expenseComment.findUnique({
    where: { id: commentId },
  })

  if (!comment) throw new Error("Comment not found")

  // IDOR Protection: only author can delete
  if (comment.authorId !== userId) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "deleteExpenseComment_unauthorized", commentId },
    })
    throw new Error("Unauthorized: You can only delete your own comments")
  }

  await prisma.expenseComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  })

  try {
    await pusherServer.trigger(`expense-${comment.expenseId}`, "expense.comment_deleted", {
      commentId,
      expenseId: comment.expenseId,
    })
  } catch (err) {}

  return { success: true }
}
