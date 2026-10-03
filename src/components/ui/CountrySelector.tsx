"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Search, X, Check, ChevronDown } from "lucide-react"
import {
  Country,
  ALL_COUNTRIES,
  POPULAR_COUNTRY_CODES,
  getCountryByIso,
  searchCountries,
} from "@/domain/countries"

interface CountrySelectorProps {
  selectedCountry: Country
  onSelectCountry: (country: Country) => void
  disabled?: boolean
  className?: string
}

export function CountrySelector({
  selectedCountry,
  onSelectCountry,
  disabled = false,
  className = "",
}: CountrySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Popular countries for fast access when search is empty
  const popularCountries = useMemo(
    () => POPULAR_COUNTRY_CODES.map((iso) => getCountryByIso(iso)),
    []
  )

  // Filtered countries
  const filteredCountries = useMemo(
    () => searchCountries(searchQuery),
    [searchQuery]
  )

  // Handle open/close
  const handleOpen = () => {
    if (disabled) return
    setIsOpen(true)
    setSearchQuery("")
  }

  const handleClose = () => {
    setIsOpen(false)
    setSearchQuery("")
  }

  // Keyboard navigation: Escape closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === "Escape") {
        e.preventDefault()
        handleClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      // Delay slightly for smooth transition mount
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
      // Prevent background scrolling while open
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        clearTimeout(timer)
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  // Select country handler
  const handleSelect = (country: Country) => {
    onSelectCountry(country)
    handleClose()
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* TRIGGER BUTTON: [ 🇮🇳 +91 ▾ ] */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Select country code. Current: ${selectedCountry.name} (${selectedCountry.callingCode})`}
        className="flex items-center gap-1.5 h-12 px-3.5 border-r border-zinc-800 bg-transparent hover:bg-zinc-800/60 active:bg-zinc-800 text-white transition-colors text-xs font-semibold focus:outline-none select-none disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      >
        <span className="text-base leading-none select-none" aria-hidden="true">
          {selectedCountry.flag}
        </span>
        <span className="text-xs font-semibold text-zinc-200">
          {selectedCountry.callingCode}
        </span>
        <ChevronDown
          size={12}
          className={`text-zinc-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-zinc-200" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {/* MODAL / BOTTOM SHEET */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select Country"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-150"
        >
          {/* Backdrop */}
          <div
            onClick={handleClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
          />

          {/* Dialog Container: Bottom Sheet on Mobile, Centered Popover on Desktop */}
          <div className="relative w-full sm:max-w-md bg-zinc-950 border border-zinc-800/90 sm:rounded-2xl rounded-t-3xl max-h-[85vh] sm:max-h-[620px] flex flex-col shadow-2xl z-10 overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 select-none">
              <div className="w-10 h-1 bg-zinc-700/80 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-zinc-900 select-none">
              <h2 className="text-base font-semibold text-white tracking-tight">
                Select Country
              </h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close country selector"
                className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-zinc-900/80 bg-zinc-950 sticky top-0 z-10">
              <div className="flex items-center w-full h-11 rounded-xl bg-zinc-900/90 border border-zinc-800/90 px-3.5 focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500 transition-all">
                <Search size={15} className="text-zinc-500 shrink-0 mr-2.5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search country, dialing code..."
                  autoComplete="off"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="text-zinc-500 hover:text-zinc-300 p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Countries List */}
            <div className="flex-1 overflow-y-auto px-2 py-2 divide-y divide-zinc-900/60 overscroll-contain">
              {/* Popular countries section when search is empty */}
              {!searchQuery && (
                <div className="pb-2 mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 px-3 py-1.5 select-none">
                    Frequently Used
                  </p>
                  <div className="space-y-0.5">
                    {popularCountries.map((c) => {
                      const isSelected = c.iso === selectedCountry.iso
                      return (
                        <button
                          key={`pop-${c.iso}`}
                          type="button"
                          onClick={() => handleSelect(c)}
                          className={`w-full h-11 flex items-center justify-between px-3 rounded-xl transition-colors text-left text-sm ${
                            isSelected
                              ? "bg-zinc-800/90 text-white font-semibold"
                              : "hover:bg-zinc-900 text-zinc-200"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <span className="text-xl shrink-0 select-none">
                              {c.flag}
                            </span>
                            <span className="truncate">{c.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-xs text-zinc-400">
                              {c.callingCode}
                            </span>
                            {isSelected && (
                              <Check size={16} className="text-emerald-400" />
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="border-t border-zinc-900 mt-2 pt-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 px-3 py-1.5 select-none">
                      All Countries
                    </p>
                  </div>
                </div>
              )}

              {/* All / Filtered Countries */}
              <div className="space-y-0.5">
                {filteredCountries.map((c) => {
                  const isSelected = c.iso === selectedCountry.iso
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      onClick={() => handleSelect(c)}
                      className={`w-full h-11 flex items-center justify-between px-3 rounded-xl transition-colors text-left text-sm ${
                        isSelected
                          ? "bg-zinc-800/90 text-white font-semibold"
                          : "hover:bg-zinc-900 text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <span className="text-xl shrink-0 select-none">
                          {c.flag}
                        </span>
                        <span className="truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs text-zinc-400">
                          {c.callingCode}
                        </span>
                        {isSelected && (
                          <Check size={16} className="text-emerald-400" />
                        )}
                      </div>
                    </button>
                  )
                })}

                {filteredCountries.length === 0 && (
                  <div className="py-12 text-center text-zinc-500 text-sm select-none">
                    No countries matching &ldquo;{searchQuery}&rdquo;
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
