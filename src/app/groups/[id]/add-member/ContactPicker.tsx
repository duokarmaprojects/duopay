"use client"

import { useState } from "react"
import { Users } from "lucide-react"

export default function ContactPicker({ onSelect }: { onSelect: (phone: string) => void }) {
  const [error, setError] = useState<string | null>(null)

  const handlePick = async () => {
    try {
      setError(null)
      if ('contacts' in navigator && 'ContactsManager' in window) {
        const props = ['name', 'tel']
        const opts = { multiple: false }
        // @ts-ignore
        const contacts = await navigator.contacts.select(props, opts)
        
        if (contacts && contacts.length > 0) {
          const contact = contacts[0]
          if (contact.tel && contact.tel.length > 0) {
            // Clean up the phone number (remove spaces, dashes)
            let phone = contact.tel[0].replace(/[\s-()]/g, '')
            onSelect(phone)
          } else {
            setError("Selected contact doesn't have a phone number.")
          }
        }
      } else {
        setError("Contact picking is not supported on this device/browser.")
      }
    } catch (err: any) {
      console.error(err)
      setError("Failed to access contacts. " + err.message)
    }
  }

  // Only render if API might be supported (it requires HTTPS, so it might fail on HTTP localhost, but we still show it)
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handlePick}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 text-gray-900 font-semibold rounded-xl active:bg-gray-200 transition-colors"
      >
        <Users size={18} />
        Select from Contacts
      </button>
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
    </div>
  )
}
