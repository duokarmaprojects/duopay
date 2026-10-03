"use client"

import { useState, useEffect } from "react"
import { Bell, BellOff, Check, AlertCircle, Smartphone, ShieldCheck, Loader2 } from "lucide-react"
import {
  getVapidPublicKey,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestNotification,
} from "@/actions/notification"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function detectPlatform(): "android" | "ios" | "desktop" | "unknown" {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent.toLowerCase()
  if (/android/.test(ua)) return "android"
  if (/iphone|ipad|ipod/.test(ua)) return "ios"
  if (/windows|macintosh|linux/.test(ua)) return "desktop"
  return "unknown"
}

function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  )
}

export default function PushNotificationManager({
  initialEnabled = false,
}: {
  initialEnabled?: boolean
}) {
  const [isSupported, setIsSupported] = useState<boolean | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [isSubscribed, setIsSubscribed] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isIosStandalone, setIsIosStandalone] = useState(true)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const platform = detectPlatform()
      const standalone = isPwaStandalone()
      if (platform === "ios" && !standalone) {
        setIsIosStandalone(false)
      }

      if ("Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
        setIsSupported(true)
        setPermission(Notification.permission)

        navigator.serviceWorker.ready.then((reg) => {
          reg.pushManager.getSubscription().then((sub) => {
            if (sub) {
              setIsSubscribed(true)
            }
          })
        })
      } else {
        setIsSupported(false)
      }
    }
  }, [])

  const handleSubscribe = async () => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      if (!isIosStandalone) {
        throw new Error(
          "On iPhone/iPad, please add DuoPay to your Home Screen first (Share → Add to Home Screen) to enable Web Push notifications."
        )
      }

      const { publicKey, isSupported: serverSupported } = await getVapidPublicKey()
      if (!serverSupported || !publicKey) {
        throw new Error("Web Push is currently awaiting VAPID key configuration on the server.")
      }

      // Explicit user interaction required
      const perm = await Notification.requestPermission()
      setPermission(perm)

      if (perm !== "granted") {
        throw new Error("Notification permission was denied or dismissed.")
      }

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        const applicationServerKey = urlBase64ToUint8Array(publicKey)
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
      }

      const subJson = subscription.toJSON()
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error("Failed to generate secure push credentials from browser.")
      }

      await subscribeToPush({
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
        userAgent: navigator.userAgent.slice(0, 500),
        platform: detectPlatform(),
      })

      setIsSubscribed(true)
      setSuccessMessage("Notifications enabled! DuoPay will alert you on payments and expenses.")
    } catch (err: any) {
      setError(err.message || "Failed to enable notifications")
    } finally {
      setLoading(false)
    }
  }

  const handleUnsubscribe = async () => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await unsubscribeFromPush(subscription.endpoint)
        await subscription.unsubscribe()
      }

      setIsSubscribed(false)
      setSuccessMessage("Notifications have been disabled for this device.")
    } catch (err: any) {
      setError(err.message || "Failed to disable notifications")
    } finally {
      setLoading(false)
    }
  }

  const handleSendTest = async () => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const res = await sendTestNotification()
      if (res.success) {
        setSuccessMessage("Test notification sent! Check your notification panel.")
      } else {
        setError(res.reason || "Failed to deliver test notification.")
      }
    } catch (err: any) {
      setError(err.message || "Test delivery error")
    } finally {
      setLoading(false)
    }
  }

  if (isSupported === false) {
    return (
      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800 flex items-start gap-3">
        <AlertCircle size={18} className="text-gray-400 dark:text-zinc-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
            Web Push not supported
          </p>
          <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
            Your current browser does not support the Push API. In-app notifications will still be visible in your feed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* iOS Not-Installed PWA Warning */}
      {!isIosStandalone && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
          <Smartphone size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-amber-900 dark:text-amber-200">
              Install DuoPay for iOS Notifications
            </p>
            <p className="text-amber-700 dark:text-amber-400 text-[11px] mt-0.5 leading-relaxed">
              Apple requires web apps to be installed to the Home Screen. Tap the Share button in Safari and select <strong>&quot;Add to Home Screen&quot;</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Main Push Toggle Card */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isSubscribed
                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500"
            }`}
          >
            {isSubscribed ? <Bell size={20} /> : <BellOff size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Web Push Notifications
              </h3>
              {isSubscribed && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Check size={10} strokeWidth={3} /> Active
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              Receive instant alerts for expenses, settlements, and rewards
            </p>
          </div>
        </div>

        <button
          onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
          disabled={loading || !isIosStandalone}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shrink-0 ${
            isSubscribed
              ? "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
              : "bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-zinc-200"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" /> Processing
            </span>
          ) : isSubscribed ? (
            "Disable"
          ) : (
            "Enable"
          )}
        </button>
      </div>

      {/* Test Push Button when active */}
      {isSubscribed && (
        <div className="flex justify-end">
          <button
            onClick={handleSendTest}
            disabled={loading}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 py-1"
          >
            <ShieldCheck size={13} /> Send Test Push Notification
          </button>
        </div>
      )}

      {/* Feedback alerts */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs border border-red-100 dark:border-red-900/50">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-100 dark:border-emerald-900/50">
          {successMessage}
        </div>
      )}
    </div>
  )
}
