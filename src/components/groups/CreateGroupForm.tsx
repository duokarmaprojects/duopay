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
  // Generate idempotency key ONCE when the form is rendered
  // This ensures retries of the same intent use the same key
  const idempotencyKey = useRef(crypto.randomUUID()).current

  return (
    <form action={createGroup} className="flex flex-col gap-8">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      
      <div className="flex flex-col gap-3">
        <label htmlFor="name" className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
          Group Name
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

      <div className="flex flex-col gap-3 items-center mt-2">
        <div className="flex flex-col gap-1 items-center text-center">
          <label className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
            Group Icon
          </label>
          <span className="text-xs text-gray-500 dark:text-zinc-400">Optional &middot; Choose an icon</span>
        </div>
        <GroupIconPicker name="image" defaultValue="" />
      </div>

      <SubmitButton />
    </form>
  )
}
