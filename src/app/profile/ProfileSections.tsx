"use client"

import { useState, useTransition, useEffect } from "react"
import { 
  Settings, Bell, Lock, ChevronRight, Check, 
  Sparkles, Smartphone, Shield, Eye, Users, RefreshCw
} from "lucide-react"
import { updateUserSettings, UpdateSettingsInput } from "@/actions/settings"

export interface UserSettingsProps {
  initialSettings: {
    currency: string
    defaultSplitMethod: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES"
    simplifyDebts: boolean
    expenseAlerts: boolean
    paymentReminders: boolean
    groupActivityAlerts: boolean
    pushNotifications: boolean
    discoverableByPhone: boolean
    shareActivityInGroup: boolean
    showUpiOnProfile: boolean
  }
}

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  id,
}: {
  checked: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
  label: string
  id: string
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white disabled:opacity-50 ${
        checked ? "bg-black dark:bg-white" : "bg-gray-200 dark:bg-zinc-700"
      }`}
    >
      <span className="sr-only">{label}</span>
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-zinc-900 shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  )
}

export default function ProfileSections({ initialSettings }: UserSettingsProps) {
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [settings, setSettings] = useState(initialSettings)
  const [isPending, startTransition] = useTransition()
  const [pushStatus, setPushStatus] = useState<string>("default")

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushStatus(Notification.permission)
    }
  }, [])

  const toggleSection = (id: string) => {
    setOpenSection((prev) => (prev === id ? null : id))
  }

  const handleUpdate = (patch: UpdateSettingsInput) => {
    setSettings((prev) => ({ ...prev, ...patch }))
    startTransition(async () => {
      try {
        await updateUserSettings(patch)
      } catch (err) {
        console.error("Failed to update user setting:", err)
      }
    })
  }

  const handleEnablePush = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("Push notifications are not supported on this browser.")
      return
    }

    try {
      const permission = await Notification.requestPermission()
      setPushStatus(permission)
      if (permission === "granted") {
        handleUpdate({ pushNotifications: true })
      } else {
        handleUpdate({ pushNotifications: false })
      }
    } catch (err) {
      console.error("Notification permission error:", err)
    }
  }

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. SETTINGS SECTION */}
      {/* ========================================================================= */}
      <div>
        <button
          type="button"
          id="trigger-settings"
          aria-expanded={openSection === "settings"}
          aria-controls="panel-settings"
          onClick={() => toggleSection("settings")}
          className="w-full flex items-center justify-between p-4 bg-white border-b border-gray-50 active:bg-gray-50 dark:active:bg-zinc-900 transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 shrink-0">
              <Settings size={20} />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900 dark:text-zinc-100">Settings</p>
              <p className="text-xs mt-0.5 text-gray-500 dark:text-zinc-400">General app preferences</p>
            </div>
          </div>
          <ChevronRight
            size={20}
            className={`text-gray-300 dark:text-zinc-600 transition-transform duration-200 motion-reduce:transition-none ${
              openSection === "settings" ? "rotate-90 text-gray-700 dark:text-zinc-200" : ""
            }`}
          />
        </button>

        <div
          id="panel-settings"
          role="region"
          aria-labelledby="trigger-settings"
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
            openSection === "settings" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
          }`}
        >
          <div className="overflow-hidden">
            <div className="bg-gray-50/80 dark:bg-zinc-900/60 border-b border-gray-100 dark:border-zinc-800/80 p-4 flex flex-col gap-4">
              {/* Currency Preference */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  Default Currency
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { code: "INR", label: "₹ INR (India)" },
                    { code: "USD", label: "$ USD (United States)" },
                    { code: "EUR", label: "€ EUR (Euro)" },
                    { code: "GBP", label: "£ GBP (United Kingdom)" },
                  ].map((cur) => (
                    <button
                      key={cur.code}
                      type="button"
                      onClick={() => handleUpdate({ currency: cur.code as any })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
                        settings.currency === cur.code
                          ? "bg-white dark:bg-zinc-800 border-black dark:border-white text-gray-900 dark:text-white shadow-xs"
                          : "bg-white/60 dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-white"
                      }`}
                    >
                      <span>{cur.label}</span>
                      {settings.currency === cur.code && <Check size={14} className="text-black dark:text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Expense Split */}
              <div className="flex flex-col gap-2 pt-2 border-t border-gray-200/60 dark:border-zinc-800">
                <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  Default Split Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "EQUAL", label: "Split Equally" },
                    { id: "EXACT", label: "Exact Amounts" },
                    { id: "PERCENTAGE", label: "By Percentage" },
                    { id: "SHARES", label: "By Shares" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleUpdate({ defaultSplitMethod: m.id as any })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
                        settings.defaultSplitMethod === m.id
                          ? "bg-white dark:bg-zinc-800 border-black dark:border-white text-gray-900 dark:text-white shadow-xs"
                          : "bg-white/60 dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-white"
                      }`}
                    >
                      <span>{m.label}</span>
                      {settings.defaultSplitMethod === m.id && <Check size={14} className="text-black dark:text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Debt Simplification */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 dark:border-zinc-800">
                <div className="pr-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Simplify Group Debts</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Restructure multi-party debts to reduce the total number of payments
                  </p>
                </div>
                <ToggleSwitch
                  id="simplify-debts-toggle"
                  label="Simplify group debts"
                  checked={settings.simplifyDebts}
                  onChange={(val) => handleUpdate({ simplifyDebts: val })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. NOTIFICATIONS SECTION */}
      {/* ========================================================================= */}
      <div>
        <button
          type="button"
          id="trigger-notifications"
          aria-expanded={openSection === "notifications"}
          aria-controls="panel-notifications"
          onClick={() => toggleSection("notifications")}
          className="w-full flex items-center justify-between p-4 bg-white border-b border-gray-50 active:bg-gray-50 dark:active:bg-zinc-900 transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 shrink-0">
              <Bell size={20} />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900 dark:text-zinc-100">Notifications</p>
              <p className="text-xs mt-0.5 text-gray-500 dark:text-zinc-400">Alerts and reminders</p>
            </div>
          </div>
          <ChevronRight
            size={20}
            className={`text-gray-300 dark:text-zinc-600 transition-transform duration-200 motion-reduce:transition-none ${
              openSection === "notifications" ? "rotate-90 text-gray-700 dark:text-zinc-200" : ""
            }`}
          />
        </button>

        <div
          id="panel-notifications"
          role="region"
          aria-labelledby="trigger-notifications"
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
            openSection === "notifications" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
          }`}
        >
          <div className="overflow-hidden">
            <div className="bg-gray-50/80 dark:bg-zinc-900/60 border-b border-gray-100 dark:border-zinc-800/80 p-4 flex flex-col gap-3.5">
              {/* Browser Push Notifications */}
              <div className="p-3 bg-white dark:bg-zinc-800/80 rounded-2xl border border-gray-200/80 dark:border-zinc-700 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone size={16} className="text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-bold text-gray-900 dark:text-zinc-100">Push Notifications</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      pushStatus === "granted"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : pushStatus === "denied"
                        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {pushStatus === "granted" ? "Enabled" : pushStatus === "denied" ? "Blocked" : "Not Set"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Receive instant alerts on this device when someone splits an expense or settles up with you.
                </p>
                {pushStatus !== "granted" ? (
                  <button
                    type="button"
                    onClick={handleEnablePush}
                    className="mt-1 py-2 px-3 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold active:scale-98 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Bell size={13} />
                    <span>Enable Device Notifications</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gray-600 dark:text-zinc-300 font-medium">Send push alerts</span>
                    <ToggleSwitch
                      id="push-alerts-toggle"
                      label="Send push alerts"
                      checked={settings.pushNotifications}
                      onChange={(val) => handleUpdate({ pushNotifications: val })}
                    />
                  </div>
                )}
              </div>

              {/* Expense Alerts */}
              <div className="flex items-center justify-between pt-2">
                <div className="pr-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Expense Alerts</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Get notified whenever a friend adds or modifies an expense
                  </p>
                </div>
                <ToggleSwitch
                  id="expense-alerts-toggle"
                  label="Expense alerts"
                  checked={settings.expenseAlerts}
                  onChange={(val) => handleUpdate({ expenseAlerts: val })}
                />
              </div>

              {/* Payment & Settlement Reminders */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 dark:border-zinc-800">
                <div className="pr-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Payment Reminders</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Receive reminders when balances are settled or payments are recorded
                  </p>
                </div>
                <ToggleSwitch
                  id="payment-reminders-toggle"
                  label="Payment reminders"
                  checked={settings.paymentReminders}
                  onChange={(val) => handleUpdate({ paymentReminders: val })}
                />
              </div>

              {/* Group Activity */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 dark:border-zinc-800">
                <div className="pr-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Group Activity</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Updates when friends join your groups or leave
                  </p>
                </div>
                <ToggleSwitch
                  id="group-activity-toggle"
                  label="Group activity alerts"
                  checked={settings.groupActivityAlerts}
                  onChange={(val) => handleUpdate({ groupActivityAlerts: val })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. PRIVACY & CONTACTS SECTION */}
      {/* ========================================================================= */}
      <div>
        <button
          type="button"
          id="trigger-privacy"
          aria-expanded={openSection === "privacy"}
          aria-controls="panel-privacy"
          onClick={() => toggleSection("privacy")}
          className="w-full flex items-center justify-between p-4 bg-white last:border-b-0 border-b border-gray-50 active:bg-gray-50 dark:active:bg-zinc-900 transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white last:rounded-b-2xl"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 shrink-0">
              <Lock size={20} />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900 dark:text-zinc-100">Privacy & Contacts</p>
              <p className="text-xs mt-0.5 text-gray-500 dark:text-zinc-400">Security and visibility</p>
            </div>
          </div>
          <ChevronRight
            size={20}
            className={`text-gray-300 dark:text-zinc-600 transition-transform duration-200 motion-reduce:transition-none ${
              openSection === "privacy" ? "rotate-90 text-gray-700 dark:text-zinc-200" : ""
            }`}
          />
        </button>

        <div
          id="panel-privacy"
          role="region"
          aria-labelledby="trigger-privacy"
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
            openSection === "privacy" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
          }`}
        >
          <div className="overflow-hidden">
            <div className="bg-gray-50/80 dark:bg-zinc-900/60 border-b border-gray-100 dark:border-zinc-800/80 p-4 flex flex-col gap-3.5 last:rounded-b-2xl">
              {/* Discoverable by Phone */}
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Users size={15} className="text-gray-500 dark:text-zinc-400" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Contact Matching</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Allow friends who have your phone number in their contacts to find you on DuoPay
                  </p>
                </div>
                <ToggleSwitch
                  id="discoverable-toggle"
                  label="Contact matching"
                  checked={settings.discoverableByPhone}
                  onChange={(val) => handleUpdate({ discoverableByPhone: val })}
                />
              </div>

              {/* Show UPI on Profile */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 dark:border-zinc-800">
                <div className="pr-4">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Eye size={15} className="text-gray-500 dark:text-zinc-400" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Show UPI ID</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Display your verified UPI ID to group members when they settle balances with you
                  </p>
                </div>
                <ToggleSwitch
                  id="show-upi-toggle"
                  label="Show UPI ID"
                  checked={settings.showUpiOnProfile}
                  onChange={(val) => handleUpdate({ showUpiOnProfile: val })}
                />
              </div>

              {/* Share Activity in Groups */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 dark:border-zinc-800">
                <div className="pr-4">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Shield size={15} className="text-gray-500 dark:text-zinc-400" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Group Activity Visibility</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Display your settlements and expenses in group activity timelines
                  </p>
                </div>
                <ToggleSwitch
                  id="share-activity-toggle"
                  label="Share activity in groups"
                  checked={settings.shareActivityInGroup}
                  onChange={(val) => handleUpdate({ shareActivityInGroup: val })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
