"use client"

import { useState, useEffect, useRef } from "react"
import { X, Send, Image, Trash2, Edit2, Loader2, MessageSquare, AlertCircle } from "lucide-react"
import {
  getExpenseComments,
  addExpenseComment,
  editExpenseComment,
  deleteExpenseComment,
} from "@/actions/comment"
import { createAttachment } from "@/actions/attachment"
import { getPusherClient } from "@/lib/realtime/pusher"

interface CommentItem {
  id: string
  expenseId: string
  authorId: string
  body: string
  createdAt: string | Date
  updatedAt: string | Date
  author: {
    id: string
    name: string | null
    image: string | null
  }
}

interface Props {
  expenseId: string
  expenseDescription: string
  currentUserId: string
  isOpen: boolean
  onClose: () => void
}

export default function ExpenseCommentsModal({
  expenseId,
  expenseDescription,
  currentUserId,
  isOpen,
  onClose,
}: Props) {
  const [comments, setComments] = useState<CommentItem[]>([])
  const [inputText, setInputText] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")

  const commentsEndRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Load comments when opened
  useEffect(() => {
    if (!isOpen) return
    let isMounted = true

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await getExpenseComments(expenseId)
        if (isMounted) {
          setComments(res as CommentItem[])
          setTimeout(scrollToBottom, 50)
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to load comments")
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [isOpen, expenseId])

  // Realtime Pusher subscription
  useEffect(() => {
    if (!isOpen) return
    const pusher = getPusherClient()
    if (!pusher) return

    const channelName = `expense-${expenseId}`
    const channel = pusher.subscribe(channelName)

    const handleCreated = (data: any) => {
      setComments((prev) => {
        if (prev.some((c) => c.id === data.id)) return prev
        return [...prev, data as CommentItem]
      })
      setTimeout(scrollToBottom, 50)
    }

    const handleUpdated = (data: { commentId: string; body: string }) => {
      setComments((prev) =>
        prev.map((c) => (c.id === data.commentId ? { ...c, body: data.body } : c))
      )
    }

    const handleDeleted = (data: { commentId: string }) => {
      setComments((prev) => prev.filter((c) => c.id !== data.commentId))
    }

    channel.bind("expense.comment_created", handleCreated)
    channel.bind("expense.comment_updated", handleUpdated)
    channel.bind("expense.comment_deleted", handleDeleted)

    return () => {
      channel.unbind("expense.comment_created", handleCreated)
      channel.unbind("expense.comment_updated", handleUpdated)
      channel.unbind("expense.comment_deleted", handleDeleted)
      pusher.unsubscribe(channelName)
    }
  }, [isOpen, expenseId])

  if (!isOpen) return null

  // File selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10MB limit")
      return
    }

    setSelectedFile(file)
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file)
      setFilePreview(url)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    if (filePreview) {
      URL.revokeObjectURL(filePreview)
      setFilePreview(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Add Comment
  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if ((!inputText.trim() && !selectedFile) || submitting) return

    setError(null)
    setSubmitting(true)
    const textToSend = inputText.trim() || (selectedFile ? `[Attachment: ${selectedFile.name}]` : "")
    const idempotencyKey = crypto.randomUUID()

    try {
      const res = await addExpenseComment(expenseId, textToSend, idempotencyKey)

      if (selectedFile) {
        setUploadingAttachment(true)
        const formData = new FormData()
        formData.append("file", selectedFile)
        formData.append("expenseId", expenseId)
        await createAttachment(formData)
        clearFile()
      }

      setInputText("")
      setTimeout(scrollToBottom, 50)
    } catch (err: any) {
      setError(err.message || "Failed to post comment")
    } finally {
      setSubmitting(false)
      setUploadingAttachment(false)
    }
  }

  // Save Edit
  const handleSaveEdit = async (commentId: string) => {
    if (!editingText.trim()) return
    try {
      await editExpenseComment(commentId, editingText.trim())
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, body: editingText.trim() } : c))
      )
      setEditingId(null)
    } catch (err: any) {
      alert(err.message || "Failed to edit comment")
    }
  }

  // Delete Comment
  const handleDelete = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return
    try {
      await deleteExpenseComment(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (err: any) {
      alert(err.message || "Failed to delete comment")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg h-[80vh] sm:h-[620px] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">
              {expenseDescription}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Comments & Discussion
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
              <Loader2 className="animate-spin text-blue-500" size={24} />
              <span className="text-xs font-medium">Loading comments...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-500 gap-2 text-center">
              <MessageSquare size={24} className="text-slate-300 dark:text-slate-700" />
              <p className="font-medium text-xs">No comments yet</p>
              <p className="text-[11px] text-slate-400">Be the first to leave a comment on this expense.</p>
            </div>
          ) : (
            comments.map((comment) => {
              const isMine = comment.authorId === currentUserId
              const isEditing = editingId === comment.id

              return (
                <div
                  key={comment.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">
                      {comment.author?.name || "Member"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">
                        {new Date(comment.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {new Date(comment.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isMine && !isEditing && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingId(comment.id)
                              setEditingText(comment.body)
                            }}
                            className="p-1 text-slate-400 hover:text-blue-500 rounded"
                            title="Edit"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(comment.id)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 mt-2">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                        maxLength={1000}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(comment.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                      {comment.body}
                    </p>
                  )}
                </div>
              )
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mb-2 p-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
            <AlertCircle size={14} className="shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Attachment preview */}
        {filePreview && (
          <div className="mx-4 mb-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <img
                src={filePreview}
                alt="Preview"
                className="w-8 h-8 object-cover rounded-lg shrink-0"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[160px]">
                {selectedFile?.name}
              </span>
            </div>
            <button
              onClick={clearFile}
              className="text-xs text-slate-400 hover:text-red-500 font-bold px-2 py-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input Composer */}
        <form
          onSubmit={handleAddComment}
          className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image"
            disabled={submitting || uploadingAttachment}
            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
          >
            <Image size={18} />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Add a comment..."
            maxLength={1000}
            disabled={submitting}
            className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-3.5 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-transparent dark:border-slate-700/50"
          />

          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedFile) || submitting || uploadingAttachment}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {submitting || uploadingAttachment ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
