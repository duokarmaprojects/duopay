"use client"

import { useState } from "react"
import Link from "next/link"
import { 
  CreditCard, Lock, Fingerprint,
  Activity, Download, Trash2, 
  HelpCircle, FileText, ChevronRight, X, Shield, Sparkles, Settings
} from "lucide-react"
import { updateUpiId } from "@/actions/user"
import { validateUpiFormat } from "@/domain/upi"

type SettingsListProps = {
  userName: string
  userPhone: string
  upiId: string
  email?: string
  isAdmin?: boolean
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1 mt-6">
    {children}
  </h2>
)

const Item = ({ icon: Icon, title, subtitle, href, onClick, destructive }: any) => (
  <Link 
    href={href || "#"} 
    onClick={onClick}
    className={`flex items-center justify-between p-4 bg-[#121316] border-b border-zinc-800/60 active:bg-zinc-800/40 transition-colors first:rounded-t-2xl last:rounded-b-2xl last:border-b-0 ${
      destructive ? 'text-red-400' : 'text-zinc-100'
    }`}
  >
    <div className="flex items-center gap-3.5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        destructive ? 'bg-red-950/40 text-red-400 border border-red-900/30' : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/40'
      }`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="font-semibold text-sm leading-tight">{title}</p>
        {subtitle && (
          <p className={`text-xs mt-0.5 leading-tight ${destructive ? 'text-red-400/80' : 'text-zinc-400'}`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
    <ChevronRight size={18} className={destructive ? 'text-red-900' : 'text-zinc-600'} />
  </Link>
)

export default function SettingsList({ userName, userPhone, upiId, email, isAdmin }: SettingsListProps) {
  const [isEditingUpi, setIsEditingUpi] = useState(false)
  const [newUpi, setNewUpi] = useState(upiId)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const handleNotImplemented = (e: React.MouseEvent) => {
    e.preventDefault()
    alert("This feature is coming soon.")
  }

  const handleDeleteAccount = (e: React.MouseEvent) => {
    e.preventDefault()
    const confirmed = confirm("Are you sure you want to delete your account? This action cannot be undone.")
    if (confirmed) {
      alert("Please contact DuoPay support to complete account deletion.")
    }
  }

  const handleUpdateUpi = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const check = validateUpiFormat(newUpi)
    if (!check.valid || !check.normalized) {
      setError(check.error || "Invalid UPI ID format.")
      return
    }

    setIsSaving(true)
    try {
      await updateUpiId(check.normalized)
      setIsEditingUpi(false)
    } catch (err: any) {
      setError(err.message || "Failed to update UPI ID")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col px-4">
      <SectionTitle>Payments</SectionTitle>
      <div className="bg-[#121316] rounded-2xl border border-zinc-800/80 shadow-sm flex flex-col overflow-hidden">
        <Item 
          icon={CreditCard} 
          title="UPI Details" 
          subtitle={upiId || "Add UPI ID"} 
          onClick={(e: React.MouseEvent) => { e.preventDefault(); setIsEditingUpi(true); }} 
        />
        <Item 
          icon={Settings} 
          title="Manage Payment Information" 
          subtitle="Cards, Bank Accounts" 
          onClick={handleNotImplemented} 
        />
        <Item 
          icon={Sparkles} 
          title="Rewards" 
          subtitle="View cashback & points" 
          href="/rewards" 
        />
      </div>

      <SectionTitle>Security</SectionTitle>
      <div className="bg-[#121316] rounded-2xl border border-zinc-800/80 shadow-sm flex flex-col overflow-hidden">
        <Item 
          icon={Fingerprint} 
          title="Biometric Unlock" 
          subtitle="Fingerprint, Face ID & App Lock" 
          href="/settings/security" 
        />
        <Item 
          icon={Lock} 
          title="Security & Login" 
          subtitle={email || "Phone Authentication"} 
          href="/settings/security" 
        />
      </div>

      <SectionTitle>Data</SectionTitle>
      <div className="bg-[#121316] rounded-2xl border border-zinc-800/80 shadow-sm flex flex-col overflow-hidden">
        <Item 
          icon={Activity} 
          title="My Activity" 
          href="/activity" 
        />
        <Item 
          icon={Download} 
          title="Export My Data" 
          onClick={handleNotImplemented} 
        />
        <Item 
          icon={Trash2} 
          title="Delete Account" 
          destructive={true} 
          onClick={handleDeleteAccount} 
        />
      </div>

      <SectionTitle>Support</SectionTitle>
      <div className="bg-[#121316] rounded-2xl border border-zinc-800/80 shadow-sm flex flex-col overflow-hidden">
        <Item 
          icon={HelpCircle} 
          title="Help & Support" 
          onClick={handleNotImplemented} 
        />
        <Item 
          icon={FileText} 
          title="Terms & Privacy" 
          onClick={handleNotImplemented} 
        />
      </div>

      {isAdmin && (
        <>
          <SectionTitle>Admin</SectionTitle>
          <div className="bg-[#121316] rounded-2xl border border-zinc-800/80 shadow-sm flex flex-col overflow-hidden">
            <Item 
              icon={Shield} 
              title="Admin Panel" 
              subtitle="Internal metrics and system tools" 
              href="/admin" 
            />
          </div>
        </>
      )}

      {/* Edit UPI Modal */}
      {isEditingUpi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121316] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-zinc-800 animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-zinc-800/80 flex justify-between items-center bg-[#15171b]">
              <h2 className="font-bold text-sm text-zinc-100">Update UPI ID</h2>
              <button 
                type="button"
                onClick={() => setIsEditingUpi(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 bg-zinc-800/80 rounded-full transition-colors border border-zinc-700/60"
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUpi} className="p-5 flex flex-col gap-4">
              <p className="text-xs text-zinc-400">
                Update your UPI ID to receive payments from friends directly into your bank account.
              </p>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  UPI ID
                </label>
                <input 
                  type="text" 
                  value={newUpi}
                  onChange={e => setNewUpi(e.target.value)}
                  placeholder="e.g. name@bank"
                  className="w-full border border-zinc-800 bg-[#15171b] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-mono text-sm text-zinc-100"
                  required
                />
                {error && <p className="text-xs font-semibold text-red-400 mt-1">{error}</p>}
              </div>

              <div className="flex gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingUpi(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-zinc-700 text-zinc-300 font-semibold text-xs hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !newUpi.includes('@')}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl text-xs active:scale-98 transition-all disabled:opacity-50 shadow-md"
                >
                  {isSaving ? "Saving..." : "Save UPI"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
