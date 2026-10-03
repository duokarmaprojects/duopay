"use client"

import { useState } from "react"
import { CheckCircle2, AlertTriangle, X, Loader2, ShieldCheck, ShieldAlert, ArrowRight } from "lucide-react"
import { verifyUpiIdAction, updateUpiId } from "@/actions/user"
import { validateUpiFormat } from "@/domain/upi"

interface UpiModalProps {
  currentUpiId: string | null
  isVerified: boolean
  verifiedName?: string | null
}

export default function UpiModal({
  currentUpiId,
  isVerified,
  verifiedName,
}: UpiModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [upiInput, setUpiInput] = useState(currentUpiId || "")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formatError, setFormatError] = useState<string | null>(null)
  
  // Verification states: idle | verified | failed | unavailable | rate_limited
  const [verificationResult, setVerificationResult] = useState<{
    status: "idle" | "verified" | "failed" | "unavailable" | "rate_limited"
    message?: string
    verifiedName?: string
  }>({ status: "idle" })

  const handleOpen = () => {
    setUpiInput(currentUpiId || "")
    setFormatError(null)
    setVerificationResult({ status: "idle" })
    setIsOpen(true)
  }

  const handleInputChange = (val: string) => {
    setUpiInput(val)
    setVerificationResult({ status: "idle" })
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

  const handleVerify = async () => {
    const check = validateUpiFormat(upiInput)
    if (!check.valid || !check.normalized) {
      setFormatError(check.error || "Please enter a valid UPI format first.")
      return
    }

    setFormatError(null)
    setIsVerifying(true)
    setVerificationResult({ status: "idle" })

    try {
      const res = await verifyUpiIdAction(check.normalized)

      if (res.status === "VERIFIED" && res.exists) {
        setVerificationResult({
          status: "verified",
          verifiedName: res.verifiedName,
          message: "UPI ID verified successfully.",
        })
      } else if (res.status === "RATE_LIMITED") {
        setVerificationResult({
          status: "rate_limited",
          message: res.message,
        })
      } else if (res.status === "UNAVAILABLE") {
        setVerificationResult({
          status: "unavailable",
          message: res.message,
        })
      } else {
        setVerificationResult({
          status: "failed",
          message: res.message || "This UPI ID could not be confirmed. Please check the UPI ID and try again.",
        })
      }
    } catch (err: any) {
      setVerificationResult({
        status: "unavailable",
        message: err.message || "Unable to verify right now. Please try again later.",
      })
    } finally {
      setIsVerifying(false)
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
      {/* Trigger Button / Badge */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold active:scale-95 transition-all shadow-xs"
        style={{
          backgroundColor: isVerified ? "#ecfdf5" : "#fffbeb",
          borderColor: isVerified ? "#a7f3d0" : "#fde68a",
          color: isVerified ? "#065f46" : "#92400e",
        }}
      >
        {isVerified ? (
          <>
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>✓ Verified UPI</span>
          </>
        ) : (
          <>
            <AlertTriangle size={13} className="text-amber-600" />
            <span>⚠ UPI not verified</span>
          </>
        )}
        <span className="text-[10px] opacity-75 underline ml-1">Edit</span>
      </button>

      {/* Verification Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {isVerified ? (
                  <ShieldCheck className="text-emerald-600" size={20} />
                ) : (
                  <ShieldAlert className="text-amber-600" size={20} />
                )}
                <h3 className="font-bold text-base text-gray-900">UPI Details & Verification</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-900 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Status Box */}
            <div
              className={`p-3.5 rounded-2xl border text-xs ${
                isVerified
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                  : "bg-amber-50/70 border-amber-200 text-amber-900"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold uppercase tracking-wider text-[10px]">Current Status</span>
                <span className="font-semibold">
                  {isVerified ? "✓ Verified" : "⚠ Not Verified"}
                </span>
              </div>
              <p className="font-mono font-medium text-sm text-gray-900">
                {currentUpiId || "None set"}
              </p>
              {isVerified && verifiedName && (
                <p className="text-[11px] text-emerald-800 mt-1">Name at Bank: {verifiedName}</p>
              )}
              {!isVerified && (
                <p className="text-[11px] text-amber-800 mt-1">
                  Unverified UPI IDs are not treated as trusted payment destinations.
                </p>
              )}
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
                  placeholder="username@bank"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              {formatError && (
                <p className="text-xs text-red-600 font-medium mt-0.5">{formatError}</p>
              )}
            </div>

            {/* Verify Button */}
            <button
              type="button"
              onClick={handleVerify}
              disabled={isVerifying || !upiInput.trim() || !!formatError}
              className="w-full bg-gray-900 hover:bg-black text-white font-semibold py-3 px-4 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying UPI ID...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>Verify UPI ID</span>
                </>
              )}
            </button>

            {/* Verification Result Display */}
            {verificationResult.status === "verified" && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                  <CheckCircle2 size={16} />
                  <span>✓ UPI ID verified</span>
                </div>
                <p className="font-mono text-xs font-semibold text-emerald-950 mt-1">
                  {upiInput.toLowerCase().trim()}
                </p>
                {verificationResult.verifiedName && (
                  <p className="text-xs text-emerald-800">
                    <span className="font-medium">Name:</span> {verificationResult.verifiedName}
                  </p>
                )}
              </div>
            )}

            {verificationResult.status === "failed" && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-red-700 font-bold text-sm">
                  <X size={16} />
                  <span>✕ UPI ID could not be verified</span>
                </div>
                <p className="text-xs text-red-600 mt-1">
                  {verificationResult.message || "This UPI ID could not be confirmed. Please check the UPI ID and try again."}
                </p>
              </div>
            )}

            {verificationResult.status === "unavailable" && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-sm">
                  <AlertTriangle size={16} />
                  <span>Unable to verify right now</span>
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  {verificationResult.message}
                </p>
              </div>
            )}

            {verificationResult.status === "rate_limited" && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-sm">
                  <AlertTriangle size={16} />
                  <span>Rate Limit Exceeded</span>
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  {verificationResult.message}
                </p>
              </div>
            )}

            {/* Save Button */}
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
                className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 ${
                  verificationResult.status === "verified"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-black hover:bg-gray-800 text-white"
                }`}
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <span>{verificationResult.status === "verified" ? "Save Verified" : "Save UPI"}</span>
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
