"use client"

import { useState, useRef } from "react"
import { useFormStatus } from "react-dom"
import { createGroup } from "@/actions/group"
import { GroupIconPicker } from "@/components/ui/GroupIconPicker"
import { Loader2 } from "lucide-react"

function SubmitButton() {
  const { pending } = useFormStatus()
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-8 w-full bg-black dark:bg-white text-white dark:text-gray-900 font-bold py-4 px-4 rounded-xl active:bg-gray-800 dark:active:bg-gray-200 transition-colors shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {pending ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Creating...</span>
        </>
      ) : (
        <span>Save Group</span>
      )}
    </button>
  )
}

export function CreateGroupForm() {
  const idempotencyKey = useRef(crypto.randomUUID()).current
  const [type, setType] = useState<"GROUP" | "TRIP" | "COLLECTION">("GROUP")

  return (
    <form action={createGroup} className="flex flex-col gap-6">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      
      <div className="flex flex-col gap-3">
        <label className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
          What are you creating?
        </label>
        <div className="flex gap-2">
          {["GROUP", "TRIP", "COLLECTION"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t as any)}
              className={`flex-1 py-3 px-2 rounded-xl text-sm font-semibold transition-colors border ${
                type === t 
                  ? "bg-black text-white border-black dark:bg-white dark:text-gray-900 dark:border-white" 
                  : "bg-transparent text-gray-700 dark:text-zinc-300 border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
              }`}
            >
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <input type="hidden" name="type" value={type} />
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="name" className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
          {type === "TRIP" ? "Trip Name" : type === "COLLECTION" ? "Collection Name" : "Group Name"}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={50}
          className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-zinc-100 focus:border-transparent text-lg bg-transparent text-gray-900 dark:text-zinc-100"
        />
      </div>

      {type === "TRIP" && (
        <>
          <div className="flex flex-col gap-3">
            <label htmlFor="destination" className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
              Destination
            </label>
            <input
              id="destination"
              name="destination"
              type="text"
              maxLength={50}
              className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-zinc-100 focus:border-transparent text-lg bg-transparent text-gray-900 dark:text-zinc-100"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-3 flex-1">
              <label htmlFor="startDate" className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                Start Date
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-zinc-100 focus:border-transparent text-lg bg-transparent text-gray-900 dark:text-zinc-100"
              />
            </div>
            <div className="flex flex-col gap-3 flex-1">
              <label htmlFor="endDate" className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                End Date
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-zinc-100 focus:border-transparent text-lg bg-transparent text-gray-900 dark:text-zinc-100"
              />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <label htmlFor="tripTargetAmount" className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
              Trip Budget (₹) - Optional
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-lg">₹</span>
              <input
                id="tripTargetAmount"
                name="targetAmount_display"
                type="number"
                min="1"
                onChange={(e) => {
                  const val = e.target.value;
                  const hiddenInput = document.getElementById("targetAmountHiddenTrip") as HTMLInputElement;
                  if (hiddenInput && val) {
                    hiddenInput.value = (parseFloat(val) * 100).toString();
                  } else if (hiddenInput) {
                    hiddenInput.value = "";
                  }
                }}
                className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-zinc-100 focus:border-transparent text-lg bg-transparent text-gray-900 dark:text-zinc-100"
              />
              <input type="hidden" id="targetAmountHiddenTrip" name="targetAmount" />
            </div>
          </div>
        </>
      )}

      {type === "COLLECTION" && (
        <>
          <div className="flex flex-col gap-3">
            <label htmlFor="targetAmount" className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
              Target Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-lg">₹</span>
              <input
                id="targetAmount"
                name="targetAmount_display" // We'll need to convert this to paise in submit or just handle it
                type="number"
                min="1"
                onChange={(e) => {
                  const val = e.target.value;
                  const hiddenInput = document.getElementById("targetAmountHidden") as HTMLInputElement;
                  if (hiddenInput && val) {
                    hiddenInput.value = (parseFloat(val) * 100).toString();
                  } else if (hiddenInput) {
                    hiddenInput.value = "";
                  }
                }}
                className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-zinc-100 focus:border-transparent text-lg bg-transparent text-gray-900 dark:text-zinc-100"
              />
              <input type="hidden" id="targetAmountHidden" name="targetAmount" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <label htmlFor="deadline" className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
              Deadline
            </label>
            <input
              id="deadline"
              name="deadline"
              type="date"
              className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-zinc-100 focus:border-transparent text-lg bg-transparent text-gray-900 dark:text-zinc-100"
            />
          </div>
        </>
      )}

      <div className="flex flex-col gap-3 items-center mt-2">
        <div className="flex flex-col gap-1 items-center text-center">
          <label className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
            {type === "TRIP" ? "Trip Icon" : type === "COLLECTION" ? "Collection Icon" : "Group Icon"}
          </label>
          <span className="text-xs text-gray-500 dark:text-zinc-400">Optional &middot; Choose an icon</span>
        </div>
        <GroupIconPicker name="image" defaultValue="" />
      </div>

      <SubmitButton />
    </form>
  )
}
