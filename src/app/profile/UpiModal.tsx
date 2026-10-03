"use client"

import { useState, useEffect } from "react"
import { X, Loader2, ArrowRight, CreditCard } from "lucide-react"
import { updateUpiId } from "@/actions/user"
import { validateUpiFormat } from "@/domain/upi"

interface UpiModalProps {
  currentUpiId: string | null
}

export function UpiDetailsCard({ currentUpiId }: { currentUpiId?: string | null }) {
  const handleClick = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-upi-modal"))
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Edit UPI payment information"
      className="flex-1 bg-white hover:bg-zinc-50/80 rounded-2xl p-4 border border-gray-100 hover:border-gray-200 shadow-sm flex flex-col gap-3 text-left transition-all active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
    >
      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
        <CreditCard size={18} />
      </div>
      <div className="min-w-0 w-full">
        <p className="font-semibold text-sm text-gray-900">UPI Details</p>
        <p className="text-[11px] text-gray-500 mt-0.5 truncate font-mono">
          {currentUpiId || "Edit payment info"}
        </p>
      </div>
    </button>
  )
}

export default function UpiModal({ currentUpiId }: UpiModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const initialUpi = currentUpiId && currentUpiId !== "username@bank" ? currentUpiId : ""
  const [upiInput, setUpiInput] = useState(initialUpi)
  const [isSaving, setIsSaving] = useState(false)
  const [formatError, setFormatError] = useState<string | null>(null)

  const handleOpen = () => {
    setUpiInput(currentUpiId && currentUpiId !== "username@bank" ? currentUpiId : "")
    setFormatError(null)
    setIsOpen(true)
  }

  useEffect(() => {
    const handleGlobalOpen = () => handleOpen()
    window.addEventListener("open-upi-modal", handleGlobalOpen)
    return () => window.removeEventListener("open-upi-modal", handleGlobalOpen)
  }, [currentUpiId])

  const handleInputChange = (val: string) => {
    setUpiInput(val)
    if (!val.trim()) {
      setFormatError(null)
      return
    }
    const check = validateUpiFormat(val)
    if (!check.valid) {
      setFormatError(check.error || "Invalid UPI ID format.")
    } else {
      setFormatError(null)
    }
  }

  const handleSave = async () => {
    const check = validateUpiFormat(upiInput)
    if (!check.valid || !check.normalized) {
      setFormatError(check.error || "Invalid UPI ID format.")
      return
    }

    setIsSaving(true)
    try {
      await updateUpiId(check.normalized)
      setIsOpen(false)
    } catch (err: any) {
      setFormatError(err.message || "Failed to save UPI ID.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <CreditCard size={18} />
                </div>
                <h3 className="font-bold text-base text-gray-900">UPI ID</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-900 rounded-full"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Input Section */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                UPI ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={upiInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="e.g. name@oksbi"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <p className="text-xs text-gray-500">
                Enter the UPI ID where you receive payments.
              </p>
              {formatError && (
                <p className="text-xs text-red-600 font-medium mt-0.5">{formatError}</p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm active:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !upiInput.trim() || !!formatError}
                className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm bg-black hover:bg-gray-800 text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <span>Save</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
