"use client"

import { useState, useEffect } from "react"
import { X, ArrowRightLeft, AlertTriangle, CheckCircle, Loader2 } from "lucide-react"
import { getUserGroups, previewMoveExpense, moveExpense } from "@/actions/moveExpense"

interface GroupOption {
  id: string
  name: string
  image: string | null
  type: string
}

interface PreviewState {
  canMove: boolean
  message: string
  missingParticipants: string[]
  sourceGroupName?: string
  destinationGroupName?: string
}

interface Props {
  expenseId: string
  expenseDescription: string
  amountPaise: number
  currentGroupId: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function MoveExpenseModal({
  expenseId,
  expenseDescription,
  amountPaise,
  currentGroupId,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load candidate destination groups
  useEffect(() => {
    if (!isOpen) return
    let isMounted = true

    async function load() {
      setLoadingGroups(true)
      setError(null)
      setPreview(null)
      setSelectedGroupId("")
      try {
        const userGroups = await getUserGroups()
        if (isMounted) {
          // Exclude the current group
          const available = (userGroups as GroupOption[]).filter((g) => g.id !== currentGroupId)
          setGroups(available)
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to load groups")
      } finally {
        if (isMounted) setLoadingGroups(false)
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [isOpen, currentGroupId])

  // Run preview check when a destination group is selected
  const handleSelectGroup = async (destId: string) => {
    setSelectedGroupId(destId)
    setPreview(null)
    setError(null)
    if (!destId) return

    setPreviewLoading(true)
    try {
      const res = await previewMoveExpense(expenseId, destId)
      setPreview({
        canMove: res.canMove,
        message: res.message,
        missingParticipants: res.missingParticipants,
        sourceGroupName: res.sourceGroupName,
        destinationGroupName: res.destinationGroupName,
      })
    } catch (err: any) {
      setError(err.message || "Failed to check move eligibility")
    } finally {
      setPreviewLoading(false)
    }
  }

  // Execute atomic move
  const handleExecuteMove = async () => {
    if (!selectedGroupId || !preview?.canMove || moving) return

    setError(null)
    setMoving(true)
    try {
      const formData = new FormData()
      formData.append("expenseId", expenseId)
      formData.append("destinationGroupId", selectedGroupId)
      formData.append("idempotencyKey", crypto.randomUUID())

      await moveExpense(formData)
      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to move expense")
    } finally {
      setMoving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ArrowRightLeft size={16} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Move Expense</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Transfer between groups</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Expense Details Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Expense</p>
            <p className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{expenseDescription}</p>
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
              ₹{(amountPaise / 100).toFixed(2)}
            </p>
          </div>

          {/* Destination Group Select */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
              Destination Group
            </label>
            {loadingGroups ? (
              <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Loading your groups...
              </div>
            ) : groups.length === 0 ? (
              <p className="text-xs text-slate-500 p-2">
                You are not a member of any other groups to move this expense to.
              </p>
            ) : (
              <select
                value={selectedGroupId}
                onChange={(e) => handleSelectGroup(e.target.value)}
                disabled={moving}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs px-3.5 py-2.5 rounded-xl border border-transparent dark:border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a destination group...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.type})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Preview Check Status */}
          {previewLoading && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin text-blue-500" />
              Checking participant membership...
            </div>
          )}

          {preview && (
            <div
              className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                preview.canMove
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300"
                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300"
              }`}
            >
              <div className="flex items-start gap-2">
                {preview.canMove ? (
                  <CheckCircle size={16} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                )}
                <div className="space-y-1">
                  <p className="font-semibold">
                    {preview.canMove ? "Ready to Move" : "Action Required"}
                  </p>
                  <p>{preview.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={moving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteMove}
            disabled={!preview?.canMove || moving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center gap-1.5"
          >
            {moving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Moving...
              </>
            ) : (
              <>
                <ArrowRightLeft size={14} />
                Confirm Move
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
