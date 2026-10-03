"use client"

import { useState, useEffect } from "react"
import { WifiOff, Wifi, RefreshCw } from "lucide-react"

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      setShowBanner(true)
      const timer = setTimeout(() => setShowBanner(false), 3000)
      return () => clearTimeout(timer)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowBanner(true)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (!showBanner && isOnline) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
        isOnline
          ? "bg-emerald-600 text-white"
          : "bg-amber-500 text-black shadow-md"
      }`}
    >
      {isOnline ? (
        <>
          <Wifi size={14} />
          <span>Back online — connection restored</span>
        </>
      ) : (
        <>
          <WifiOff size={14} />
          <span>You are offline — cached data is read-only. Financial actions require connection.</span>
        </>
      )}
    </div>
  )
}
