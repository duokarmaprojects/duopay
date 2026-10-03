"use client"
import { useState, useEffect } from "react"
import { Download } from "lucide-react"

interface InstallPwaButtonProps {
  className?: string
  label?: string
}

export function InstallPwaButton({ className, label = "Install DuoPay" }: InstallPwaButtonProps) {
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
      className={
        className ||
        "w-full flex items-center justify-center gap-2 bg-transparent hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 font-medium py-3 px-4 rounded-xl transition-all border border-zinc-800/80 text-xs active:scale-[0.99]"
      }
    >
      <Download size={14} className="opacity-70" />
      {label}
    </button>
  )
}
