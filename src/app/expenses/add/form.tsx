"use client"

import { useState, useMemo, useEffect } from "react"
import { addExpense } from "@/actions/expense"
import { Check, Percent, IndianRupee, Hash, Equal, Sparkles } from "lucide-react"
import { 
  calculateEqualSplit, 
  calculatePercentageSplit, 
  calculateExactSplit, 
  calculateSharesSplit,
  inrToPaise,
  paiseToInr
} from "@/domain/money"
import { useSearchParams } from "next/navigation"
import { ExpenseIconPicker } from "@/components/expenses/ExpenseIconPicker"
import { ExpenseCategory, getExpenseCategory } from "@/domain/expenseIcon"
import { getSmartExpenseSuggestions, ExpenseSuggestions } from "@/actions/suggestions"

type Member = { id: string; name: string; image: string | null }
type SplitMethod = "EQUAL" | "PERCENTAGE" | "EXACT" | "SHARES"

export function AddExpenseForm({ groupId, members, currentUserId }: { groupId: string, members: Member[], currentUserId: string }) {
  const searchParams = useSearchParams()
  const [payerId, setPayerId] = useState(currentUserId)
  const [amountStr, setAmountStr] = useState(searchParams.get("amount") || "")
  const [description, setDescription] = useState(searchParams.get("desc") || "")
  const [categoryId, setCategoryId] = useState<ExpenseCategory | "AUTO">("AUTO")
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("EQUAL")
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(
    new Set(members.map(m => m.id))
  )
  
  // splitData holds either percentages, exact amounts (in INR for UI), or share counts
  const [splitData, setSplitData] = useState<Record<string, number>>({})

  const [suggestions, setSuggestions] = useState<ExpenseSuggestions | null>(null)

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await getSmartExpenseSuggestions(description)
        setSuggestions(res)
      } catch {
        // Advisory only - ignore failures
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [description])

  const amountPaise = useMemo(() => inrToPaise(parseFloat(amountStr) || 0), [amountStr])
  const activeParticipants = Array.from(selectedParticipants)

  const toggleParticipant = (id: string) => {
    const next = new Set(selectedParticipants)
    if (next.has(id)) {
      if (next.size > 1) next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedParticipants(next)
  }

  const handleSplitMethodChange = (newMethod: SplitMethod) => {
    setSplitMethod(newMethod)
    const newData: Record<string, number> = {}
    
    if (newMethod === "PERCENTAGE") {
      // Default to equal percentages
      const base = Math.floor(100 / activeParticipants.length)
      const remainder = 100 % activeParticipants.length
      activeParticipants.forEach((id, idx) => {
        newData[id] = base + (idx < remainder ? 1 : 0)
      })
    } else if (newMethod === "EXACT") {
      if (amountPaise > 0) {
        try {
          const eq = calculateEqualSplit(amountPaise, activeParticipants)
          activeParticipants.forEach(id => {
            newData[id] = paiseToInr(eq[id])
          })
        } catch {
          activeParticipants.forEach(id => newData[id] = 0)
        }
      } else {
        activeParticipants.forEach(id => newData[id] = 0)
      }
    } else if (newMethod === "SHARES") {
      activeParticipants.forEach(id => newData[id] = 1)
    }
    setSplitData(newData)
  }

  const handleDataChange = (userId: string, valStr: string) => {
    const num = parseFloat(valStr) || 0
    setSplitData(prev => ({ ...prev, [userId]: num }))
  }

  // Calculate live preview
  let calculatedShares: Record<string, number> = {}
  let validationError = ""
  let totalPercent = 0
  let totalExactInr = 0
  let totalShares = 0

  if (amountPaise > 0 && activeParticipants.length > 0) {
    try {
      if (splitMethod === "PERCENTAGE") {
        totalPercent = activeParticipants.reduce((sum, id) => sum + (splitData[id] || 0), 0)
        if (Math.abs(totalPercent - 100) > 0.01) {
          validationError = `Need ${totalPercent > 100 ? (totalPercent - 100).toFixed(1) + "% less" : (100 - totalPercent).toFixed(1) + "% more"}`
        } else {
          // Prepare for calculation
          const pData: Record<string, number> = {}
          activeParticipants.forEach(id => pData[id] = splitData[id] || 0)
          calculatedShares = calculatePercentageSplit(amountPaise, pData)
        }
      } else if (splitMethod === "EXACT") {
        totalExactInr = activeParticipants.reduce((sum, id) => sum + (splitData[id] || 0), 0)
        const exactPaise: Record<string, number> = {}
        activeParticipants.forEach(id => exactPaise[id] = inrToPaise(splitData[id] || 0))
        
        const totalExactPaise = activeParticipants.reduce((sum, id) => sum + exactPaise[id], 0)
        if (totalExactPaise !== amountPaise) {
          const diffInr = paiseToInr(Math.abs(amountPaise - totalExactPaise))
          validationError = `₹${diffInr} ${totalExactPaise > amountPaise ? "over" : "remaining"}`
        } else {
          calculatedShares = calculateExactSplit(amountPaise, exactPaise)
        }
      } else if (splitMethod === "SHARES") {
        totalShares = activeParticipants.reduce((sum, id) => sum + (splitData[id] || 0), 0)
        if (totalShares <= 0) {
          validationError = "Total shares must be > 0"
        } else {
          const sData: Record<string, number> = {}
          activeParticipants.forEach(id => sData[id] = splitData[id] || 0)
          calculatedShares = calculateSharesSplit(amountPaise, sData)
        }
      } else {
        calculatedShares = calculateEqualSplit(amountPaise, activeParticipants)
      }
    } catch (e: any) {
      validationError = e.message || "Invalid split"
    }
  }

  // Pre-prepare exact data payload for server to handle floating point cleanly
  let payloadSplitData = {}
  if (splitMethod === "EXACT") {
    const exactPaise: Record<string, number> = {}
    activeParticipants.forEach(id => exactPaise[id] = inrToPaise(splitData[id] || 0))
    payloadSplitData = exactPaise
  } else {
    payloadSplitData = splitData
  }

  const isValid = amountPaise > 0 && activeParticipants.length > 0 && !validationError

  return (
    <form action={addExpense} className="flex flex-col p-6 pb-40">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="splitMethod" value={splitMethod} />
      <input type="hidden" name="splitData" value={JSON.stringify(payloadSplitData)} />
      <input type="hidden" name="category" value={categoryId === "AUTO" ? getExpenseCategory(description) : categoryId} />
      
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-[#1a222c] border border-gray-200 dark:border-gray-800 rounded-2xl focus-within:ring-2 focus-within:ring-black dark:focus-within:ring-white transition-all">
            <ExpenseIconPicker 
              currentCategory={categoryId} 
              onSelect={setCategoryId} 
              description={description} 
            />
            <input
              name="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this for?"
              required
              className="flex-1 bg-transparent border-none outline-none text-xl dark:text-zinc-100 placeholder:text-gray-400 py-3 pr-4"
            />
          </div>

          {/* Smart Suggestions Chips */}
          {suggestions && suggestions.recentDescriptions.length > 0 && !description && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 scrollbar-none">
              <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 shrink-0">
                <Sparkles size={11} className="text-amber-500" /> Recent:
              </span>
              {suggestions.recentDescriptions.map((desc) => (
                <button
                  key={desc}
                  type="button"
                  onClick={() => setDescription(desc)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 whitespace-nowrap transition-colors"
                >
                  {desc}
                </button>
              ))}
            </div>
          )}

          {suggestions && suggestions.typicalAmountPaise && !amountStr && (
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setAmountStr((suggestions.typicalAmountPaise! / 100).toFixed(2))}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Sparkles size={11} /> Suggested amount: ₹{(suggestions.typicalAmountPaise / 100).toFixed(2)}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Amount (₹)</label>
          <div className="flex items-center">
            <span className="text-3xl font-medium text-gray-400 mr-2">₹</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              required
              className="w-full border-b border-gray-300 py-3 text-4xl font-bold focus:outline-none focus:border-black placeholder:text-gray-200"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-4">
          <label className="text-sm font-medium text-gray-700">Who paid?</label>
          <select 
            name="payerId" 
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
          >
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.id === currentUserId ? "You" : m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Split Methods */}
        <div className="flex flex-col gap-3 mt-4">
          <label className="text-sm font-medium text-gray-700">How should this be split?</label>
          <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
            {(
              [
                { id: "EQUAL", label: "Equal", icon: Equal },
                { id: "PERCENTAGE", label: "%", icon: Percent },
                { id: "EXACT", label: "₹", icon: IndianRupee },
                { id: "SHARES", label: "Shares", icon: Hash },
              ] as const
            ).map((method) => {
              const Icon = method.icon
              const active = splitMethod === method.id
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => handleSplitMethodChange(method.id as SplitMethod)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-colors ${
                    active ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                  }`}
                >
                  <Icon size={14} />
                  {method.label}
                </button>
              )
            })}
          </div>
        </div>
        
        {/* Participants & Inputs */}
        <div className="flex flex-col gap-2 mt-2">
          {members.map(m => {
            const isSelected = selectedParticipants.has(m.id)
            return (
              <div key={m.id} className={`flex flex-col p-3 rounded-xl border ${isSelected ? 'border-black bg-gray-50' : 'border-gray-200'} transition-colors`}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center cursor-pointer flex-1">
                    <input 
                      type="checkbox" 
                      name="participants" 
                      value={m.id} 
                      checked={isSelected}
                      onChange={() => toggleParticipant(m.id)}
                      className="sr-only" 
                    />
                    <div className={`w-6 h-6 rounded-md border flex items-center justify-center mr-3 ${isSelected ? 'bg-black border-black text-white' : 'border-gray-300'}`}>
                      {isSelected && <Check size={16} strokeWidth={3} />}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden mr-3">
                      {m.image ? <img src={m.image} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-medium">{m.name.charAt(0)}</div>}
                    </div>
                    <span className="font-medium text-gray-900">{m.id === currentUserId ? "You" : m.name}</span>
                  </label>
                  
                  {/* Dynamic Input based on Split Method */}
                  {isSelected && splitMethod !== "EQUAL" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step={splitMethod === "EXACT" ? "0.01" : "1"}
                        value={splitData[m.id] === undefined ? "" : splitData[m.id]}
                        onChange={(e) => handleDataChange(m.id, e.target.value)}
                        className="w-20 text-right bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-black text-sm"
                        placeholder="0"
                      />
                      <span className="text-xs font-semibold text-gray-500 w-4">
                        {splitMethod === "PERCENTAGE" ? "%" : splitMethod === "SHARES" ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Live Preview */}
        {amountPaise > 0 && activeParticipants.length > 0 && (
          <div className="mt-6 p-5 bg-gray-50 border border-gray-100 rounded-2xl">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Split Preview</h3>
            
            <div className="flex flex-col gap-3">
              {activeParticipants.map(id => {
                const member = members.find(m => m.id === id)
                return (
                  <div key={id} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">{member?.id === currentUserId ? "You" : member?.name}</span>
                    <div className="flex items-center gap-4">
                      {splitMethod === "PERCENTAGE" && <span className="text-xs text-gray-400">{splitData[id] || 0}%</span>}
                      {splitMethod === "SHARES" && <span className="text-xs text-gray-400">{splitData[id] || 0} {splitData[id] === 1 ? 'share' : 'shares'}</span>}
                      <span className="text-sm font-bold text-gray-900">
                        ₹{calculatedShares[id] !== undefined ? paiseToInr(calculatedShares[id]) : "0.00"}
                      </span>
                    </div>
                  </div>
                )
              })}
              
              <div className="border-t border-gray-200 mt-2 pt-3 flex justify-between items-center">
                <span className="font-bold text-gray-900">Total</span>
                <div className="flex items-center gap-3">
                  {validationError ? (
                    <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-md">{validationError}</span>
                  ) : (
                    <>
                      {splitMethod === "PERCENTAGE" && <span className="text-xs font-semibold text-emerald-600">100% ✓</span>}
                      {splitMethod === "SHARES" && <span className="text-xs font-semibold text-emerald-600">{totalShares} shares ✓</span>}
                      <span className="text-sm font-bold text-emerald-600">₹{parseFloat(amountStr).toFixed(2)} ✓</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 max-w-md mx-auto z-20">
        <button
          type="submit"
          disabled={!isValid}
          className="w-full bg-black text-white font-semibold py-4 px-4 rounded-xl active:bg-gray-800 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Expense
        </button>
      </div>
    </form>
  )
}
