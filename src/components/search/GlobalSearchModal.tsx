"use client"

import { useState, useEffect, useRef } from "react"
import { Search, X, Loader2, Users, User, Receipt, CheckCircle2, ChevronRight } from "lucide-react"
import Link from "next/link"
import { searchGlobal, SearchResultItem } from "@/actions/search"
import { ExpenseIcon } from "@/components/expenses/ExpenseIcon"

export default function GlobalSearchModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string>("ALL")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery("")
      setResults([])
    }
  }, [isOpen])

  // Debounced search effect
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const handler = setTimeout(async () => {
      try {
        const res = await searchGlobal(trimmed)
        setResults(res.results)
      } catch (err) {
        console.error("Search failed:", err)
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(handler)
  }, [query])

  const filteredResults = results.filter((item) => {
    if (activeFilter === "ALL") return true
    return item.type === activeFilter
  })

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white shrink-0"
        aria-label="Search"
        title="Search Expenses, Groups & Friends"
      >
        <Search size={18} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh] mt-4 animate-in slide-in-from-top-4 duration-200">
            {/* Search Input Bar */}
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3">
              <Search size={20} className="text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search expenses, groups, friends..."
                className="flex-1 bg-transparent text-sm sm:text-base outline-none text-gray-900 dark:text-zinc-100 placeholder:text-gray-400"
              />
              {loading && <Loader2 size={18} className="animate-spin text-gray-400 shrink-0" />}
              {query && !loading && (
                <button
                  onClick={() => setQuery("")}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
                >
                  <X size={16} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1"
              >
                Close
              </button>
            </div>

            {/* Filter Tabs */}
            {results.length > 0 && (
              <div className="px-4 py-2 bg-gray-50 dark:bg-zinc-800/40 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {(
                  [
                    { id: "ALL", label: "All" },
                    { id: "EXPENSE", label: "Expenses" },
                    { id: "GROUP", label: "Groups" },
                    { id: "FRIEND", label: "Friends" },
                    { id: "SETTLEMENT", label: "Settlements" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveFilter(t.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeFilter === t.id
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Results / Empty States */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {query.trim().length < 2 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  Type at least 2 characters to search...
                </div>
              ) : loading ? (
                <div className="py-12 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                  <Loader2 size={24} className="animate-spin text-gray-400" />
                  <span>Searching authorized records...</span>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  No matching results found for &ldquo;{query}&rdquo;
                </div>
              ) : (
                filteredResults.map((item) => (
                  <Link
                    key={item.id}
                    href={item.url}
                    onClick={() => setIsOpen(false)}
                    className="p-3 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.type === "EXPENSE" ? (
                        <ExpenseIcon
                          category={item.category}
                          description={item.title}
                          className="w-9 h-9 rounded-xl shrink-0"
                        />
                      ) : item.type === "GROUP" ? (
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Users size={18} />
                        </div>
                      ) : item.type === "FRIEND" ? (
                        <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                          <User size={18} />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCircle2 size={18} />
                        </div>
                      )}

                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.amount !== undefined && (
                        <span className="text-xs font-bold font-mono text-gray-900 dark:text-zinc-100">
                          ₹{(item.amount / 100).toFixed(2)}
                        </span>
                      )}
                      <ChevronRight size={16} className="text-gray-400" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
