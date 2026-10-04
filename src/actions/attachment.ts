"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { logSecurityEvent } from "@/lib/securityAudit"
import { validateId, sanitizeTextInput } from "@/lib/security"
import { validateImageMagicBytes } from "@/domain/receipt"

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]

export async function createAttachment(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "createAttachment" },
    })
    throw new Error("Unauthorized")
  }
  const userId = session.user.id

  const file = formData.get("file") as File | null
  const groupId = (formData.get("groupId") as string) || null
  const expenseId = (formData.get("expenseId") as string) || null
  const messageId = (formData.get("messageId") as string) || null

  if (!file) throw new Error("File is required")

  if (file.size > MAX_ATTACHMENT_SIZE) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId,
      details: { action: "attachment_file_too_large", size: file.size },
    })
    throw new Error("File exceeds maximum allowed size of 10MB")
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId,
      details: { action: "attachment_invalid_mime", mime: file.type },
    })
    throw new Error(`Disallowed file type: ${file.type}. Only JPEG, PNG, and WebP images are permitted`)
  }

  const arrayBuffer = await file.arrayBuffer()
  const isValidMagic = validateImageMagicBytes(arrayBuffer, file.type)
  if (!isValidMagic) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId,
      details: { action: "attachment_magic_bytes_mismatch", mime: file.type },
    })
    throw new Error("Invalid image header: content does not match reported MIME type")
  }

  // Parent resource access verification
  if (groupId) {
    validateId(groupId, "groupId")
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    })
    if (!member) {
      await logSecurityEvent({
        type: "IDOR_ATTEMPT_BLOCKED",
        userId,
        details: { action: "createAttachment_group_not_member", groupId },
      })
      throw new Error("Unauthorized: You are not a member of this group")
    }
  }

  if (expenseId) {
    validateId(expenseId, "expenseId")
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        group: { include: { members: true } },
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
        details: { action: "createAttachment_expense_unauthorized", expenseId },
      })
      throw new Error("Unauthorized: You do not have access to this expense")
    }
  }

  if (messageId) {
    validateId(messageId, "messageId")
    const message = await prisma.groupMessage.findUnique({
      where: { id: messageId },
    })
    if (!message) throw new Error("Message not found")

    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: message.groupId, userId } },
    })
    if (!member) {
      await logSecurityEvent({
        type: "IDOR_ATTEMPT_BLOCKED",
        userId,
        details: { action: "createAttachment_message_unauthorized", messageId },
      })
      throw new Error("Unauthorized: You cannot attach to this message")
    }
  }

  // SHA-256 calculation for deduplication
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer)
  const sha256 = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  const cleanFileName = sanitizeTextInput(file.name || "attachment", 120)
  const storageKey = `attachments/${userId}/${crypto.randomUUID()}-${cleanFileName}`

  const attachment = await prisma.attachment.create({
    data: {
      ownerId: userId,
      groupId: groupId || null,
      expenseId: expenseId || null,
      messageId: messageId || null,
      storageKey,
      fileName: cleanFileName,
      mimeType: file.type,
      sizeBytes: file.size,
      sha256,
    },
  })

  return {
    success: true,
    attachment: {
      id: attachment.id,
      storageKey: attachment.storageKey,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    },
  }
}

export async function getAttachment(attachmentId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  validateId(attachmentId, "attachmentId")

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: {
      group: { include: { members: true } },
      expense: {
        include: {
          group: { include: { members: true } },
          participants: true,
        },
      },
      message: true,
    },
  })

  if (!attachment) throw new Error("Attachment not found")

  // IDOR Protection: Verify caller has access
  let authorized = false
  if (attachment.ownerId === userId) {
    authorized = true
  } else if (attachment.groupId && attachment.group) {
    authorized = attachment.group.members.some((m) => m.userId === userId)
  } else if (attachment.expenseId && attachment.expense) {
    if (attachment.expense.groupId && attachment.expense.group) {
      authorized = attachment.expense.group.members.some((m) => m.userId === userId)
    } else {
      authorized =
        attachment.expense.payerId === userId ||
        attachment.expense.participants.some((p) => p.userId === userId)
    }
  } else if (attachment.messageId && attachment.message) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: attachment.message.groupId, userId } },
    })
    authorized = Boolean(member)
  }

  if (!authorized) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "getAttachment_unauthorized", attachmentId },
    })
    throw new Error("Unauthorized: Access denied")
  }

  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    storageKey: attachment.storageKey,
    createdAt: attachment.createdAt,
    ownerId: attachment.ownerId,
  }
}

export async function deleteAttachment(attachmentId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  validateId(attachmentId, "attachmentId")

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
  })

  if (!attachment) throw new Error("Attachment not found")

  // IDOR Protection: only owner can delete
  if (attachment.ownerId !== userId) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "deleteAttachment_unauthorized", attachmentId },
    })
    throw new Error("Unauthorized: You can only delete your own attachments")
  }

  await prisma.attachment.delete({
    where: { id: attachmentId },
  })

  return { success: true }
}
