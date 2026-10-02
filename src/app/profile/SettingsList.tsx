"use client"

import { useState } from "react"
import Link from "next/link"
import { 
  User, CreditCard, Lock, 
  Bell, Users, Palette, 
  Activity, Download, Trash2, 
  HelpCircle, FileText, ChevronRight, X
} from "lucide-react"
import { updateUpiId } from "@/actions/user"

type SettingsListProps = {
  userName: string
  userPhone: string
  upiId: string
  email?: string
}

export default function SettingsList({ userName, userPhone, upiId, email }: SettingsListProps) {
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
    setIsSaving(true)
    setError("")
    try {
      await updateUpiId(newUpi)
      setIsEditingUpi(false)
    } catch (err: any) {
      setError(err.message || "Failed to update UPI ID")
    } finally {
      setIsSaving(false)
    }
  }

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-4 mt-8">{children}</h2>
  )

  const Item = ({ icon: Icon, title, subtitle, href, onClick, destructive }: any) => (
    <Link 
      href={href || "#"} 
      onClick={onClick}
      className={`flex items-center justify-between p-4 bg-white border-b border-gray-50 active:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl last:border-b-0 ${destructive ? 'text-red-600' : 'text-gray-900'}`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${destructive ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="font-semibold text-sm">{title}</p>
          {subtitle && <p className={`text-xs mt-0.5 ${destructive ? 'text-red-400' : 'text-gray-500'}`}>{subtitle}</p>}
        </div>
      </div>
      <ChevronRight size={20} className={destructive ? 'text-red-300' : 'text-gray-300'} />
    </Link>
  )

  return (
    <div className="flex flex-col pb-8">
      <SectionTitle>Account</SectionTitle>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mx-4 flex flex-col">
        <Item 
          icon={User} 
          title="Profile" 
          subtitle={`${userName} · ${userPhone || 'No phone'}`} 
          onClick={handleNotImplemented} 
        />
        <Item 
          icon={CreditCard} 
          title="UPI Details" 
          subtitle="Edit payment info" 
          onClick={(e: React.MouseEvent) => { e.preventDefault(); setIsEditingUpi(true); }} 
        />
        <Item 
          icon={Lock} 
          title="Security & Login" 
          subtitle={email || "Phone Authentication"} 
          onClick={handleNotImplemented} 
        />
      </div>

      <SectionTitle>App</SectionTitle>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mx-4 flex flex-col">
        <Item 
          icon={Bell} 
          title="Notifications" 
          subtitle="Expenses · Payments · Reminders" 
          onClick={handleNotImplemented} 
        />
        <Item 
          icon={Users} 
          title="Contacts & Privacy" 
          subtitle="Contact sync" 
          onClick={handleNotImplemented} 
        />
        <Item 
          icon={Palette} 
          title="Appearance" 
          subtitle="System" 
          onClick={handleNotImplemented} 
        />
      </div>

      <SectionTitle>Data</SectionTitle>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mx-4 flex flex-col">
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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mx-4 flex flex-col">
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

      {isEditingUpi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="font-bold text-gray-900">UPI Details</h2>
              <button 
                onClick={() => setIsEditingUpi(false)}
                className="p-2 text-gray-400 hover:text-gray-900 bg-white rounded-full transition-colors shadow-sm border border-gray-200"
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUpi} className="p-5">
              <p className="text-sm text-gray-500 mb-4">
                Update your UPI ID to receive payments from your friends seamlessly.
              </p>
              
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  UPI ID
                </label>
                <input 
                  type="text" 
                  value={newUpi}
                  onChange={e => setNewUpi(e.target.value)}
                  placeholder="e.g. name@bank"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent font-medium text-gray-900"
                  required
                />
                {error && <p className="text-xs font-semibold text-red-500 mt-1">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={isSaving || !newUpi.includes('@')}
                className="w-full mt-6 bg-black text-white font-semibold py-3.5 rounded-xl active:bg-gray-800 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-md"
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
