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
  <h2 className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-4 mt-8">{children}</h2>
)

const Item = ({ icon: Icon, title, subtitle, href, onClick, destructive }: any) => (
  <Link 
    href={href || "#"} 
    onClick={onClick}
    className={`flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-gray-50 dark:border-zinc-800/80 active:bg-gray-50 dark:active:bg-zinc-800 transition-colors first:rounded-t-2xl last:rounded-b-2xl last:border-b-0 ${destructive ? 'text-red-600 dark:text-red-500' : 'text-gray-900 dark:text-zinc-100'}`}
  >
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${destructive ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-500' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        {subtitle && <p className={`text-xs mt-0.5 ${destructive ? 'text-red-400 dark:text-red-400' : 'text-gray-500 dark:text-zinc-500'}`}>{subtitle}</p>}
      </div>
    </div>
    <ChevronRight size={20} className={destructive ? 'text-red-300 dark:text-red-900' : 'text-gray-300 dark:text-zinc-700'} />
  </Link>
)

export default function SettingsList({ userName, userPhone, upiId, email, isAdmin }: SettingsListProps) {
  const [isEditingUpi, setIsEditingUpi] = useState(false)
  const [newUpi, setNewUpi] = useState(upiId)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const handleNotImplemented = (e: React.MouseEvent) => {
    e.preventDefault()
    alert("This feature requires backend implementation (Settings API/Schema updates).")
  }

  const handleDeleteAccount = (e: React.MouseEvent) => {
    e.preventDefault()
    const confirmed = confirm("Are you sure you want to delete your account? This action cannot be undone.")
    if (confirmed) {
      alert("Backend account deletion logic needs to be implemented first.")
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
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col">
        <Item 
          icon={CreditCard} 
          title="UPI Details" 
          subtitle="Edit payment info" 
          onClick={(e: React.MouseEvent) => { e.preventDefault(); setIsEditingUpi(true); }} 
        />
        <Item 
          icon={Settings} 
          title="Manage Payment Information" 
          subtitle="Cards, Banks" 
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
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col">
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
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col">
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
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col">
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
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col">
            <Item 
              icon={Shield} 
              title="Admin Panel" 
              subtitle="Internal metrics and tools" 
              href="/admin" 
            />
          </div>
        </>
      )}

      {isEditingUpi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-zinc-800">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-900/50">
              <h2 className="font-bold text-gray-900 dark:text-zinc-100">UPI Details</h2>
              <button 
                onClick={() => setIsEditingUpi(false)}
                className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-zinc-100 bg-white dark:bg-zinc-800 rounded-full transition-colors shadow-sm border border-gray-200 dark:border-zinc-700"
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUpi} className="p-5">
              <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">
                Update your UPI ID to receive payments from your friends seamlessly.
              </p>
              
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  UPI ID
                </label>
                <input 
                  type="text" 
                  value={newUpi}
                  onChange={e => setNewUpi(e.target.value)}
                  placeholder="e.g. name@bank"
                  className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-zinc-100 focus:border-transparent font-medium text-gray-900 dark:text-zinc-100"
                  required
                />
                {error && <p className="text-xs font-semibold text-red-500 mt-1">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={isSaving || !newUpi.includes('@')}
                className="w-full mt-6 bg-black dark:bg-white text-white dark:text-black font-semibold py-3.5 rounded-xl active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-md"
              >
                {isSaving ? "Saving..." : "Save UPI Details"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
