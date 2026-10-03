"use client"

import Link from "next/link"
import { Gift } from "lucide-react"

interface ReferralHeaderButtonProps {
  className?: string
}

export default function ReferralHeaderButton({ className = "" }: ReferralHeaderButtonProps) {
  return (
    <div
      className={`relative inline-flex items-center rounded-full bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-emerald-500/10 dark:from-amber-400/15 dark:via-amber-300/10 dark:to-emerald-400/15 border border-amber-300/80 dark:border-amber-500/40 shadow-xs hover:border-amber-400 dark:hover:border-amber-400/60 transition-all group ${className}`}
    >
      {/* Main navigation to /referrals */}
      <Link
        href="/referrals"
        className="flex items-center gap-1.5 py-1.5 pl-2.5 sm:pl-3 pr-1 md:pr-3 lg:pr-0.5 text-xs font-semibold text-gray-900 dark:text-zinc-100 hover:text-amber-700 dark:hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-l-full md:rounded-full lg:rounded-l-full active:scale-95 transition-transform"
        aria-label="Refer friends and earn up to ₹21"
      >
        {/* Subtle premium gift icon with controlled pulse */}
        <span className="relative flex items-center justify-center">
          <Gift
            size={14}
            className="text-amber-600 dark:text-amber-400 shrink-0 transition-transform group-hover:scale-110"
          />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse opacity-75" />
        </span>

        {/* Desktop display (lg+): "Refer & Earn ₹21" */}
        <span className="hidden lg:inline tracking-tight">Refer &amp; Earn</span>
        <span className="hidden lg:inline font-bold text-amber-700 dark:text-amber-300">₹21</span>

        {/* Tablet display (md to lg): "Refer & Earn" */}
        <span className="hidden md:inline lg:hidden tracking-tight">Refer &amp; Earn</span>

        {/* Mobile display (< md): "₹21" */}
        <span className="md:hidden font-bold text-amber-700 dark:text-amber-300">₹21</span>
      </Link>

      {/* Direct link to /referrals/terms on the asterisk '*' */}
      {/* Visible on Mobile (< md) and Desktop (lg+). Hidden on Tablet (md to lg) per spec */}
      <Link
        href="/referrals/terms"
        className="md:hidden lg:inline-flex py-1.5 pr-2.5 pl-0.5 text-xs font-extrabold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-r-full hover:scale-125 transition-transform"
        aria-label="Referral terms and conditions"
        title="Terms & Conditions apply. Click to view."
      >
        <span className="select-none">*</span>
      </Link>
    </div>
  )
}
