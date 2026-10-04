"use client"

import { useState, useEffect, useRef } from "react"
import { Send, Image, Trash2, Loader2, MessageSquare, AlertCircle } from "lucide-react"
import { getGroupMessages, sendGroupMessage, deleteGroupMessage } from "@/actions/chat"
import { createAttachment } from "@/actions/attachment"
import { getPusherClient } from "@/lib/realtime/pusher"

interface ChatMessage {
  id: string
  groupId: string
  senderId: string
  body: string
  createdAt: string | Date
  sender?: {
    id: string
    name: string | null
    image: string | null
  }
  attachments?: Array<{
    id: string
    fileName: string | null
    mimeType: string
    storageKey?: string
  }>
}

interface GroupChatProps {
  groupId: string
  groupName: string
  currentUserId: string
}

export default function GroupChat({ groupId, groupName, currentUserId }: GroupChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Load initial messages
  useEffect(() => {
    let isMounted = true

    async function loadInitial() {
      setLoading(true)
      try {
        const res = await getGroupMessages(groupId, null, 40)
        if (isMounted) {
          setMessages(res.messages as ChatMessage[])
          setNextCursor(res.nextCursor)
          setTimeout(scrollToBottom, 100)
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to load messages")
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadInitial()

    return () => {
      isMounted = false
    }
  }, [groupId])

  // Realtime Pusher subscription
  useEffect(() => {
    const pusher = getPusherClient()
    if (!pusher) return

    const channelName = `group-${groupId}`
    const channel = pusher.subscribe(channelName)

    const handleNewMessage = (data: any) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev
        return [...prev, data as ChatMessage]
      })
      setTimeout(scrollToBottom, 50)
    }

    const handleDeleteMessage = (data: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId))
    }

    channel.bind("chat.message_created", handleNewMessage)
    channel.bind("chat.message_deleted", handleDeleteMessage)

    return () => {
      channel.unbind("chat.message_created", handleNewMessage)
      channel.unbind("chat.message_deleted", handleDeleteMessage)
      pusher.unsubscribe(channelName)
    }
  }, [groupId])

  // Handle older messages pagination
  const handleLoadOlder = async () => {
    if (!nextCursor || loadingOlder) return
    setLoadingOlder(true)
    try {
      const res = await getGroupMessages(groupId, nextCursor, 30)
      setMessages((prev) => [...(res.messages as ChatMessage[]), ...prev])
      setNextCursor(res.nextCursor)
    } catch (err: any) {
      setError(err.message || "Failed to load older messages")
    } finally {
      setLoadingOlder(false)
    }
  }

  // Handle file selection
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

  const clearSelectedFile = () => {
    setSelectedFile(null)
    if (filePreview) {
      URL.revokeObjectURL(filePreview)
      setFilePreview(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if ((!inputText.trim() && !selectedFile) || sending) return

    setError(null)
    setSending(true)
    const textToSend = inputText.trim() || (selectedFile ? `[Attachment: ${selectedFile.name}]` : "")
    const idempotencyKey = crypto.randomUUID()

    try {
      // 1. Send the chat message
      const res = await sendGroupMessage(groupId, textToSend, idempotencyKey)

      // 2. If a file was attached, create attachment linked to message & group
      if (selectedFile && res.message?.id) {
        setUploadingAttachment(true)
        const formData = new FormData()
        formData.append("file", selectedFile)
        formData.append("groupId", groupId)
        formData.append("messageId", res.message.id)
        await createAttachment(formData)
        clearSelectedFile()
      }

      setInputText("")
      setTimeout(scrollToBottom, 50)
    } catch (err: any) {
      setError(err.message || "Failed to send message")
    } finally {
      setSending(false)
      setUploadingAttachment(false)
    }
  }

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Delete this message?")) return
    try {
      await deleteGroupMessage(messageId)
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
    } catch (err: any) {
      alert(err.message || "Failed to delete message")
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Top Bar for Older Messages */}
      {nextCursor && (
        <div className="py-2 text-center border-b border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50">
          <button
            onClick={handleLoadOlder}
            disabled={loadingOlder}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            {loadingOlder ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Loading older messages...
              </>
            ) : (
              "Load earlier messages"
            )}
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
            <Loader2 className="animate-spin text-blue-500" size={24} />
            <span className="text-xs font-medium">Connecting to group chat...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-500 gap-3 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <MessageSquare size={22} className="text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No messages yet</p>
              <p className="text-xs text-slate-500 mt-0.5">Send a message to start chatting with {groupName}!</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUserId
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMine ? "items-end" : "items-start"} group`}
              >
                {!isMine && (
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 ml-1">
                    {msg.sender?.name || "Member"}
                  </span>
                )}

                <div className="relative max-w-[82%] sm:max-w-[70%]">
                  <div
                    className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${
                      isMine
                        ? "bg-blue-600 text-white rounded-br-xs"
                        : "bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-800 rounded-bl-xs"
                    }`}
                  >
                    <p>{msg.body}</p>

                    {/* Attachments if any */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-1 pt-2 border-t border-white/20 dark:border-slate-700/50">
                        {msg.attachments.map((att) => (
                          <div
                            key={att.id}
                            className={`text-xs flex items-center gap-1.5 p-1.5 rounded-lg ${
                              isMine ? "bg-blue-700/60" : "bg-slate-100 dark:bg-slate-800"
                            }`}
                          >
                            <Image size={14} />
                            <span className="truncate max-w-[180px]">
                              {att.fileName || "Image attachment"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div
                      className={`text-[10px] mt-1 text-right select-none ${
                        isMine ? "text-blue-100" : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {timeStr}
                    </div>
                  </div>

                  {/* Delete button on hover for author */}
                  {isMine && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      title="Delete message"
                      className="absolute -top-2 -left-7 p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mb-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="font-bold ml-1">
            ✕
          </button>
        </div>
      )}

      {/* Attachment Preview Banner */}
      {filePreview && (
        <div className="mx-4 mb-2 p-2 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <img
              src={filePreview}
              alt="Preview"
              className="w-10 h-10 object-cover rounded-lg shrink-0 border border-slate-200 dark:border-slate-700"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
              {selectedFile?.name}
            </span>
          </div>
          <button
            onClick={clearSelectedFile}
            className="text-xs text-slate-400 hover:text-red-500 font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Composer */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-2"
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
          disabled={sending || uploadingAttachment}
          className="p-2.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
        >
          <Image size={20} />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Message ${groupName}...`}
          maxLength={2000}
          disabled={sending}
          className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-transparent dark:border-slate-700/50"
        />

        <button
          type="submit"
          disabled={(!inputText.trim() && !selectedFile) || sending || uploadingAttachment}
          className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-sm"
        >
          {sending || uploadingAttachment ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>
    </div>
  )
}
