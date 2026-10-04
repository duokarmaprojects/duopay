"use client"

import { useState, useTransition, useEffect } from "react"
import { 
  Settings, Bell, Lock, ChevronRight, Check, 
  Users, Eye, Shield
} from "lucide-react"
import { updateUserSettings, UpdateSettingsInput } from "@/actions/settings"
import PushNotificationManager from "@/components/notifications/PushNotificationManager"

export interface UserSettingsProps {
  initialSettings: {
    currency: string
    defaultSplitMethod: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES"
    simplifyDebts: boolean
    expenseAlerts: boolean
    paymentReminders: boolean
    groupActivityAlerts: boolean
    cashbackAlerts?: boolean
    referralAlerts?: boolean
    recurringReminders?: boolean
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
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 ${
        checked ? "bg-blue-600" : "bg-zinc-800"
      }`}
    >
      <span className="sr-only">{label}</span>
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  )
}

export default function ProfileSections({ initialSettings }: UserSettingsProps) {
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [settings, setSettings] = useState(initialSettings)
  const [, startTransition] = useTransition()

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

  return (
    <div className="flex flex-col">
      <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1 mt-6">
        App & Preferences
      </h2>

      <div className="bg-[#121316] rounded-2xl border border-zinc-800/80 shadow-sm flex flex-col overflow-hidden">
        {/* ========================================================================= */}
        {/* 1. SETTINGS SECTION */}
        {/* ========================================================================= */}
        <div className="border-b border-zinc-800/60 last:border-b-0">
          <button
            type="button"
            id="trigger-settings"
            aria-expanded={openSection === "settings"}
            aria-controls="panel-settings"
            onClick={() => toggleSection("settings")}
            className="w-full flex items-center justify-between p-4 bg-[#121316] active:bg-zinc-800/40 hover:bg-zinc-800/20 transition-colors cursor-pointer text-left focus:outline-none"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-zinc-800/60 text-zinc-400 border border-zinc-700/40 shrink-0">
                <Settings size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm text-zinc-100">Preferences</p>
                <p className="text-xs mt-0.5 text-zinc-400">Currency, split rules, debt simplification</p>
              </div>
            </div>
            <ChevronRight
              size={18}
              className={`text-zinc-600 transition-transform duration-200 ${
                openSection === "settings" ? "rotate-90 text-zinc-300" : ""
              }`}
            />
          </button>

          <div
            id="panel-settings"
            role="region"
            aria-labelledby="trigger-settings"
            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
              openSection === "settings" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
            }`}
          >
            <div className="overflow-hidden">
              <div className="bg-[#15171b] border-t border-zinc-800/80 p-4 flex flex-col gap-4">
                {/* Currency Preference */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
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
                        className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all cursor-pointer ${
                          settings.currency === cur.code
                            ? "bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-xs"
                            : "bg-[#121316] border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <span>{cur.label}</span>
                        {settings.currency === cur.code && <Check size={14} className="text-blue-400" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Default Expense Split */}
                <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/60">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
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
                        className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all cursor-pointer ${
                          settings.defaultSplitMethod === m.id
                            ? "bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-xs"
                            : "bg-[#121316] border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <span>{m.label}</span>
                        {settings.defaultSplitMethod === m.id && <Check size={14} className="text-blue-400" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Debt Simplification */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                  <div className="pr-4">
                    <p className="text-sm font-semibold text-zinc-100">Simplify Group Debts</p>
                    <p className="text-xs text-zinc-400">
                      Restructure multi-party debts to minimize the total number of settlements
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
        <div className="border-b border-zinc-800/60 last:border-b-0">
          <button
            type="button"
            id="trigger-notifications"
            aria-expanded={openSection === "notifications"}
            aria-controls="panel-notifications"
            onClick={() => toggleSection("notifications")}
            className="w-full flex items-center justify-between p-4 bg-[#121316] active:bg-zinc-800/40 hover:bg-zinc-800/20 transition-colors cursor-pointer text-left focus:outline-none"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-zinc-800/60 text-zinc-400 border border-zinc-700/40 shrink-0">
                <Bell size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm text-zinc-100">Notifications</p>
                <p className="text-xs mt-0.5 text-zinc-400">Push alerts, reminders, activity</p>
              </div>
            </div>
            <ChevronRight
              size={18}
              className={`text-zinc-600 transition-transform duration-200 ${
                openSection === "notifications" ? "rotate-90 text-zinc-300" : ""
              }`}
            />
          </button>

          <div
            id="panel-notifications"
            role="region"
            aria-labelledby="trigger-notifications"
            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
              openSection === "notifications" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
            }`}
          >
            <div className="overflow-hidden">
              <div className="bg-[#15171b] border-t border-zinc-800/80 p-4 flex flex-col gap-3.5">
                {/* Real Web Push Notification Manager */}
                <PushNotificationManager initialEnabled={settings.pushNotifications} />

                {/* Expense Alerts */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                  <div className="pr-4">
                    <p className="text-sm font-semibold text-zinc-100">Expense Alerts</p>
                    <p className="text-xs text-zinc-400">
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

                {/* Payment Reminders */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                  <div className="pr-4">
                    <p className="text-sm font-semibold text-zinc-100">Payment Reminders</p>
                    <p className="text-xs text-zinc-400">
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
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                  <div className="pr-4">
                    <p className="text-sm font-semibold text-zinc-100">Group Activity</p>
                    <p className="text-xs text-zinc-400">
                      Updates when friends join or leave your groups
                    </p>
                  </div>
                  <ToggleSwitch
                    id="group-activity-toggle"
                    label="Group activity alerts"
                    checked={settings.groupActivityAlerts}
                    onChange={(val) => handleUpdate({ groupActivityAlerts: val })}
                  />
                </div>

                {/* Cashback Alerts */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                  <div className="pr-4">
                    <p className="text-sm font-semibold text-zinc-100">Cashback Rewards</p>
                    <p className="text-xs text-zinc-400">
                      Alerts when you earn instant cashback on verified settlements
                    </p>
                  </div>
                  <ToggleSwitch
                    id="cashback-alerts-toggle"
                    label="Cashback alerts"
                    checked={settings.cashbackAlerts ?? true}
                    onChange={(val) => handleUpdate({ cashbackAlerts: val })}
                  />
                </div>

                {/* Referral Alerts */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                  <div className="pr-4">
                    <p className="text-sm font-semibold text-zinc-100">Referral Rewards</p>
                    <p className="text-xs text-zinc-400">
                      Updates when invited friends sign up and unlock rewards
                    </p>
                  </div>
                  <ToggleSwitch
                    id="referral-alerts-toggle"
                    label="Referral alerts"
                    checked={settings.referralAlerts ?? true}
                    onChange={(val) => handleUpdate({ referralAlerts: val })}
                  />
                </div>

                {/* Recurring Reminders */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                  <div className="pr-4">
                    <p className="text-sm font-semibold text-zinc-100">Recurring Reminders</p>
                    <p className="text-xs text-zinc-400">
                      Upcoming reminders for scheduled rent, utilities, and subscriptions
                    </p>
                  </div>
                  <ToggleSwitch
                    id="recurring-reminders-toggle"
                    label="Recurring reminders"
                    checked={settings.recurringReminders ?? true}
                    onChange={(val) => handleUpdate({ recurringReminders: val })}
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
            className="w-full flex items-center justify-between p-4 bg-[#121316] active:bg-zinc-800/40 hover:bg-zinc-800/20 transition-colors cursor-pointer text-left focus:outline-none"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-zinc-800/60 text-zinc-400 border border-zinc-700/40 shrink-0">
                <Lock size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm text-zinc-100">Privacy & Contacts</p>
                <p className="text-xs mt-0.5 text-zinc-400">Discovery, visibility, UPI sharing</p>
              </div>
            </div>
            <ChevronRight
              size={18}
              className={`text-zinc-600 transition-transform duration-200 ${
                openSection === "privacy" ? "rotate-90 text-zinc-300" : ""
              }`}
            />
          </button>

          <div
            id="panel-privacy"
            role="region"
            aria-labelledby="trigger-privacy"
            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
              openSection === "privacy" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
            }`}
          >
            <div className="overflow-hidden">
              <div className="bg-[#15171b] border-t border-zinc-800/80 p-4 flex flex-col gap-3.5">
                {/* Discoverable by Phone */}
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Users size={14} className="text-zinc-400" />
                      <p className="text-sm font-semibold text-zinc-100">Contact Matching</p>
                    </div>
                    <p className="text-xs text-zinc-400">
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
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                  <div className="pr-4">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Eye size={14} className="text-zinc-400" />
                      <p className="text-sm font-semibold text-zinc-100">Show UPI ID</p>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Display your verified UPI ID to group members when settling balances
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
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                  <div className="pr-4">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Shield size={14} className="text-zinc-400" />
                      <p className="text-sm font-semibold text-zinc-100">Group Activity Visibility</p>
                    </div>
                    <p className="text-xs text-zinc-400">
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
      </div>
    </div>
  )
}
