"use client"
import { useState, useEffect } from "react"
import { Download } from "lucide-react"

export function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isStandalone, setIsStandalone] = useState(true)

  useEffect(() => {
    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsStandalone(true)
    } else {
      setIsStandalone(false)
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    
    // Also listen for appinstalled event to hide the button
    window.addEventListener('appinstalled', () => {
      setIsStandalone(true)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setIsStandalone(true)
      }
    } else {
      // Fallback for iOS/Safari which doesn't support beforeinstallprompt
      alert("To install DuoPay, tap the Share button in your browser and select 'Add to Home Screen'.")
    }
  }

  if (isStandalone) return null

  return (
    <button
      type="button"
      onClick={handleInstallClick}
      className="mt-6 w-full flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold py-3 px-4 rounded-xl transition-colors border border-gray-200 dark:border-gray-700 shadow-sm"
    >
      <Download size={18} />
      Install DuoPay App
    </button>
  )
}
