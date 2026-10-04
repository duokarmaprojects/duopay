"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { logSecurityEvent } from "@/lib/securityAudit"
import { validateId, sanitizeTextInput } from "@/lib/security"
import { pusherServer } from "@/lib/realtime/pusher"
import { revalidatePath } from "next/cache"

const MAX_MESSAGE_LENGTH = 2000

export async function sendGroupMessage(
  groupId: string,
  rawBody: string,
  idempotencyKey?: string | null
) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "sendGroupMessage" },
    })
    throw new Error("Unauthorized")
  }
  const userId = session.user.id

  validateId(groupId, "groupId")
  if (idempotencyKey) {
    validateId(idempotencyKey, "idempotencyKey")
  }

  // Rate Limiting: 30 chat messages per minute
  const rateLimit = checkActionRateLimit("CHAT_MESSAGE", userId)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId,
      details: { action: "sendGroupMessage" },
    })
    throw new Error("You are sending messages too quickly. Please slow down.")
  }

  // Input validation & sanitization
  if (!rawBody || !rawBody.trim()) {
    throw new Error("Message body cannot be empty")
  }
  if (rawBody.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`)
  }

  const cleanBody = sanitizeTextInput(rawBody.trim(), MAX_MESSAGE_LENGTH)

  // Verify group exists & session user is an active member
  const groupMember = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId,
      },
    },
  })

  if (!groupMember) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "sendGroupMessage_non_member", groupId },
    })
    throw new Error("Unauthorized: You are not a member of this group")
  }

  // Idempotency check: if key supplied, avoid duplicate inserts
  if (idempotencyKey) {
    const existing = await prisma.groupMessage.findFirst({
      where: {
        groupId,
        idempotencyKey,
      },
      include: {
        sender: {
          select: { id: true, name: true, image: true },
        },
      },
    })
    if (existing) {
      return { success: true, message: existing, isDuplicate: true }
    }
  }

  // Transactionally persist message
  let message: any
  try {
    message = await prisma.groupMessage.create({
      data: {
        groupId,
        senderId: userId,
        body: cleanBody,
        idempotencyKey: idempotencyKey || null,
      },
      include: {
        sender: {
          select: { id: true, name: true, image: true },
        },
        attachments: true,
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
      const existing = await prisma.groupMessage.findFirst({
        where: { groupId, idempotencyKey },
        include: {
          sender: { select: { id: true, name: true, image: true } },
          attachments: true,
        },
      })
      if (existing) {
        return { success: true, message: existing, isDuplicate: true }
      }
    }
    throw err
  }

  // Realtime Pusher broadcast ONLY AFTER DB commit
  try {
    await pusherServer.trigger(`group-${groupId}`, "chat.message_created", {
      id: message.id,
      groupId: message.groupId,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      sender: message.sender,
      attachments: message.attachments,
    })
  } catch (err) {
    // Non-blocking: Pusher failure never crashes or rolls back message
  }

  revalidatePath(`/groups/${groupId}`)
  return { success: true, message, isDuplicate: false }
}

export async function getGroupMessages(
  groupId: string,
  cursor?: string | null,
  limit = 30
) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  const userId = session.user.id

  validateId(groupId, "groupId")

  // IDOR Protection: verify user is member of the group
  const member = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId,
      },
    },
  })

  if (!member) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "getGroupMessages_non_member", groupId },
    })
    throw new Error("Unauthorized: You are not a member of this group")
  }

  const safeLimit = Math.min(Math.max(1, limit), 50)
  const where: any = {
    groupId,
    deletedAt: null,
  }

  if (cursor) {
    where.createdAt = {
      lt: new Date(cursor),
    }
  }

  const messages = await prisma.groupMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: safeLimit + 1,
    include: {
      sender: {
        select: { id: true, name: true, image: true },
      },
      attachments: true,
    },
  })

  let nextCursor: string | null = null
  let resultMessages = messages
  if (messages.length > safeLimit) {
    const nextItem = messages[safeLimit]
    nextCursor = nextItem.createdAt.toISOString()
    resultMessages = messages.slice(0, safeLimit)
  }

  // Reverse so client receives chronological order [oldest ... newest]
  return {
    messages: resultMessages.reverse(),
    nextCursor,
  }
}

export async function deleteGroupMessage(messageId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  validateId(messageId, "messageId")

  const message = await prisma.groupMessage.findUnique({
    where: { id: messageId },
  })

  if (!message) throw new Error("Message not found")

  // IDOR Protection: only sender can delete their message
  if (message.senderId !== userId) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "deleteGroupMessage_unauthorized", messageId },
    })
    throw new Error("Unauthorized: You can only delete your own messages")
  }

  await prisma.groupMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  })

  // Broadcast deletion
  try {
    await pusherServer.trigger(`group-${message.groupId}`, "chat.message_deleted", {
      messageId,
      groupId: message.groupId,
    })
  } catch (err) {}

  revalidatePath(`/groups/${message.groupId}`)
  return { success: true }
}
