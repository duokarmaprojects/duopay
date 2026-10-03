"use client"

import { useState, useEffect, useTransition } from "react"
import Image from "next/image"
import { InstallPwaButton } from "@/components/ui/InstallPwaButton"

interface LoginFormProps {
  loginAction: (formData: FormData) => Promise<void>
}

export function LoginForm({ loginAction }: LoginFormProps) {
  const [phoneDisplay, setPhoneDisplay] = useState("")
  const [rawDigits, setRawDigits] = useState("")
  const [name, setName] = useState("")
  const [isPending, startTransition] = useTransition()

  // Restore input on mount so refresh doesn't wipe out filled details
  useEffect(() => {
    try {
      const savedPhone = localStorage.getItem("duopay_login_phone")
      const savedName = localStorage.getItem("duopay_login_name")

      if (savedPhone) {
        const digits = savedPhone.replace(/\D/g, "").slice(0, 10)
        setRawDigits(digits)
        if (digits.length > 5) {
          setPhoneDisplay(`${digits.slice(0, 5)} ${digits.slice(5)}`)
        } else {
          setPhoneDisplay(digits)
        }
      }

      if (savedName) {
        setName(savedName)
      }
    } catch {
      // Storage unavailable in private browsing sandbox
    }
  }, [])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/\D/g, "")

    // Strip leading 91 if full 12 digits or 0 if 11 digits
    if (input.length === 12 && input.startsWith("91")) {
      input = input.slice(2)
    } else if (input.length === 11 && input.startsWith("0")) {
      input = input.slice(1)
    }

    // Limit to 10 digits
    const digits = input.slice(0, 10)
    setRawDigits(digits)

    try {
      localStorage.setItem("duopay_login_phone", digits)
    } catch {}

    // Format as 5 digits + space + 5 digits
    if (digits.length > 5) {
      setPhoneDisplay(`${digits.slice(0, 5)} ${digits.slice(5)}`)
    } else {
      setPhoneDisplay(digits)
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setName(val)
    try {
      localStorage.setItem("duopay_login_name", val)
    } catch {}
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (rawDigits.length < 10 || isPending) return

    const formData = new FormData()
    formData.set("phone", `+91${rawDigits}`)
    if (name.trim()) {
      formData.set("name", name.trim())
    }

    startTransition(async () => {
      await loginAction(formData)
    })
  }

  const isReady = rawDigits.length === 10

  return (
    <div className="w-full max-w-[360px] mx-auto flex flex-col justify-center my-auto px-1 py-4">
      {/* 1. BRANDING */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-[22px] sm:rounded-3xl overflow-hidden shadow-2xl shadow-black/80 border border-zinc-800 bg-zinc-950 flex items-center justify-center mb-4 ring-1 ring-white/10">
          <Image
            src="/icon-192x192.png"
            alt="DuoPay Logo"
            width={96}
            height={96}
            className="w-full h-full object-cover"
            priority
          />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          DuoPay
        </h1>
        <p className="text-sm font-medium text-zinc-400 tracking-wide mt-1.5">
          Split. Settle. Done.
        </p>
      </div>

      {/* 2. AUTH FORM */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Phone Input */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="phone-input"
            className="text-xs font-medium text-zinc-400 select-none pl-0.5"
          >
            Phone number
          </label>
          <div className="flex items-center w-full h-12 rounded-xl bg-zinc-900/90 border border-zinc-800/90 px-3.5 transition-all focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500">
            <div className="flex items-center pr-3 border-r border-zinc-800 text-xs font-semibold text-zinc-300 select-none">
              <span>+91</span>
            </div>
            <input
              id="phone-input"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={phoneDisplay}
              onChange={handlePhoneChange}
              placeholder="Enter mobile number"
              required
              disabled={isPending}
              className="flex-1 bg-transparent pl-3 text-sm font-medium text-white placeholder:text-zinc-600 focus:outline-none tracking-wider disabled:opacity-50 [color-scheme:dark]"
              style={{
                WebkitBoxShadow: "0 0 0 1000px #18181b inset",
                WebkitTextFillColor: "#ffffff",
                caretColor: "#ffffff",
              }}
            />
          </div>
        </div>

        {/* Name Input (New Users Only) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between pl-0.5">
            <label
              htmlFor="name-input"
              className="text-xs font-medium text-zinc-400 select-none"
            >
              Name
            </label>
            <span className="text-[11px] text-zinc-500 select-none">
              Only required for new accounts
            </span>
          </div>
          <input
            id="name-input"
            type="text"
            autoComplete="name"
            value={name}
            onChange={handleNameChange}
            placeholder="Your name"
            disabled={isPending}
            className="w-full h-12 rounded-xl bg-zinc-900/90 border border-zinc-800/90 px-3.5 text-sm font-normal text-white placeholder:text-zinc-600 transition-all focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 [color-scheme:dark]"
            style={{
              WebkitBoxShadow: "0 0 0 1000px #18181b inset",
              WebkitTextFillColor: "#ffffff",
              caretColor: "#ffffff",
            }}
          />
        </div>

        {/* 4. PRIMARY CTA */}
        <button
          type="submit"
          disabled={!isReady || isPending}
          className="w-full h-12 mt-2 rounded-xl bg-white hover:bg-zinc-100 active:bg-zinc-200 text-black font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
        >
          {isPending ? (
            <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Continue</span>
              <span className="text-base leading-none">→</span>
            </>
          )}
        </button>

        {/* Supporting text */}
        <p className="text-[11px] text-zinc-500 text-center select-none pt-1">
          Fast, passwordless sign in with your phone.
        </p>

        {/* 5. INSTALL BUTTON */}
        <div className="pt-2">
          <InstallPwaButton label="Install DuoPay" />
        </div>
      </form>
    </div>
  )
}
