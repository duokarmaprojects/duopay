"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { confirmReceiptExpense, dismissReceiptScan } from "@/actions/receiptScan"
import { ExtractedReceiptV2 } from "@/receipt/receiptTypes"
import { paiseToInr, inrToPaise } from "@/domain/money"
import {
  AlertTriangle,
  ShieldCheck,
  Store,
  Calendar,
  IndianRupee,
  Plus,
  Trash2,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  Receipt,
} from "lucide-react"

interface Member {
  id: string
  name: string
  image: string | null
}

interface Group {
  id: string
  name: string
  members: Member[]
}

interface ItemRow {
  id: string
  name: string
  quantity: number
  priceInr: string
}

export function ReceiptReviewClient({
  scan,
  groups,
  currentUserId,
}: {
  scan: any
  groups: Group[]
  currentUserId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const extracted = (scan.extractedData as ExtractedReceiptV2) || null

  // Form states initialized with OCR suggestions
  const [merchant, setMerchant] = useState(extracted?.merchant?.value || "Receipt Expense")
  const [date, setDate] = useState(
    extracted?.transactionDate?.value || new Date().toISOString().split("T")[0]
  )
  const initialTotalPaise = extracted?.totalPaise?.value ?? 0
  const [totalInr, setTotalInr] = useState(
    initialTotalPaise ? paiseToInr(initialTotalPaise).toString() : "0"
  )
  const [taxInr, setTaxInr] = useState(
    extracted?.taxPaise?.value ? paiseToInr(extracted.taxPaise.value).toString() : "0"
  )
  const [discountInr, setDiscountInr] = useState(
    extracted?.discountPaise?.value ? paiseToInr(extracted.discountPaise.value).toString() : "0"
  )
  const [category, setCategory] = useState("FOOD")

  // Line items
  const [items, setItems] = useState<ItemRow[]>(() => {
    if (extracted?.lineItems && extracted.lineItems.length > 0) {
      return extracted.lineItems.map((l) => ({
        id: l.id,
        name: l.name?.value || "Item",
        quantity: l.quantity?.value || 1,
        priceInr: l.lineTotalPaise?.value ? paiseToInr(l.lineTotalPaise.value).toString() : "0",
      }))
    }
    return []
  })

  // Group & participant selection
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || "")
  const selectedGroup = groups.find((g) => g.id === selectedGroupId)

  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(() => {
    return groups[0]?.members.map((m) => m.id) || [currentUserId]
  })

  const [payerId, setPayerId] = useState(currentUserId)
  const [splitMethod, setSplitMethod] = useState<"EQUAL" | "EXACT">("EQUAL")

  // Handle group change
  const handleGroupChange = (gid: string) => {
    setSelectedGroupId(gid)
    const grp = groups.find((g) => g.id === gid)
    if (grp) {
      setSelectedParticipantIds(grp.members.map((m) => m.id))
      setPayerId(grp.members.some((m) => m.id === currentUserId) ? currentUserId : grp.members[0]?.id || currentUserId)
    }
  }

  // Toggle participant
  const toggleParticipant = (pid: string) => {
    if (selectedParticipantIds.includes(pid)) {
      if (selectedParticipantIds.length > 1) {
        setSelectedParticipantIds(selectedParticipantIds.filter((id) => id !== pid))
      }
    } else {
      setSelectedParticipantIds([...selectedParticipantIds, pid])
    }
  }

  // Line items calculations
  const itemsTotalPaise = useMemo(() => {
    return items.reduce((sum, item) => sum + inrToPaise(parseFloat(item.priceInr) || 0), 0)
  }, [items])

  const parsedTotalPaise = inrToPaise(parseFloat(totalInr) || 0)
  const parsedTaxPaise = inrToPaise(parseFloat(taxInr) || 0)
  const parsedDiscountPaise = inrToPaise(parseFloat(discountInr) || 0)

  const computedTotalPaise = itemsTotalPaise + parsedTaxPaise - parsedDiscountPaise
  const deltaPaise = Math.abs(parsedTotalPaise - computedTotalPaise)
  const hasReconciliationWarning = items.length > 0 && deltaPaise > 2

  const addItem = () => {
    setItems([
      ...items,
      { id: crypto.randomUUID(), name: "New Item", quantity: 1, priceInr: "0" },
    ])
  }

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id))
  }

  const updateItem = (id: string, field: keyof ItemRow, val: string | number) => {
    setItems(
      items.map((i) => (i.id === id ? { ...i, [field]: val } : i))
    )
  }

  const handleConfirm = () => {
    if (!selectedGroupId) {
      setErrorMsg("Please select a group for this expense")
      return
    }
    if (parsedTotalPaise <= 0) {
      setErrorMsg("Expense total must be positive")
      return
    }

    setErrorMsg(null)
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.set("scanId", scan.id)
        formData.set("groupId", selectedGroupId)
        formData.set("description", merchant)
        formData.set("amount", totalInr)
        formData.set("payerId", payerId)
        formData.set("splitMethod", splitMethod)
        formData.set("category", category)

        selectedParticipantIds.forEach((pid) => {
          formData.append("participants", pid)
        })

        if (items.length > 0) {
          const receiptItemsPayload = items.map((i) => ({
            name: i.name,
            price: inrToPaise(parseFloat(i.priceInr) || 0),
            quantity: i.quantity,
          }))
          formData.set("receiptItems", JSON.stringify(receiptItemsPayload))
        }

        await confirmReceiptExpense(formData)
        router.push(`/groups/${selectedGroupId}`)
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to confirm receipt expense")
      }
    })
  }

  const handleDismiss = () => {
    startTransition(async () => {
      try {
        await dismissReceiptScan(scan.id)
        router.push("/expenses/add")
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to dismiss scan")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Zero-trust financial notice */}
      <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-800 dark:text-blue-300">
        <ShieldCheck size={18} className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <div>
          <p className="font-semibold mb-0.5">Zero-Trust Expense Verification</p>
          <p className="text-blue-700 dark:text-blue-400">
            OCR and screenshot values are suggestions only. Screenshots are never treated as verified proof of payment. Please review and confirm the exact values before adding to group balances.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 p-4 rounded-2xl flex items-center gap-3 text-sm">
          <XCircle size={18} className="shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Primary Details Card */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Receipt size={16} /> Transaction Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <Store size={14} /> Merchant / Title
            </label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:border-blue-500 transition-colors"
              placeholder="e.g. Domino's, Swiggy"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <Calendar size={14} /> Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 block">
              Total (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={totalInr}
              onChange={(e) => setTotalInr(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-base font-bold outline-none focus:border-blue-500 transition-colors text-blue-600 dark:text-blue-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 block">
              Tax (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={taxInr}
              onChange={(e) => setTaxInr(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 block">
              Discount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={discountInr}
              onChange={(e) => setDiscountInr(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 block">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:border-blue-500 transition-colors"
          >
            <option value="FOOD">Food & Dining</option>
            <option value="TRANSPORT">Transport</option>
            <option value="SHOPPING">Shopping</option>
            <option value="ENTERTAINMENT">Entertainment</option>
            <option value="BILLS">Bills & Utilities</option>
            <option value="RENT">Rent</option>
            <option value="TRAVEL">Travel</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* Reconciliation Warning */}
      {hasReconciliationWarning && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold mb-0.5">Sum Mismatch Warning</p>
            <p>
              Sum of line items (₹{(itemsTotalPaise / 100).toFixed(2)}) + Tax (₹{taxInr}) - Discount (₹{discountInr}) = ₹{(computedTotalPaise / 100).toFixed(2)}, which does not match stated Total ₹{totalInr}.
            </p>
          </div>
        </div>
      )}

      {/* Line Items Card */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
            Line Items ({items.length})
          </h2>
          <button
            type="button"
            onClick={addItem}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-zinc-400 py-2">
            No line items detected. You can add items or confirm the total as an unitemized expense.
          </p>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-100 dark:border-zinc-800"
              >
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(item.id, "name", e.target.value)}
                  className="flex-1 bg-transparent text-sm font-medium outline-none"
                  placeholder="Item description"
                />
                <div className="flex items-center gap-1 w-24">
                  <span className="text-xs text-gray-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={item.priceInr}
                    onChange={(e) => updateItem(item.id, "priceInr", e.target.value)}
                    className="w-full bg-transparent text-sm font-semibold outline-none text-right"
                    placeholder="0.00"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Split & Group Assignment */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Users size={16} /> Group & Split
        </h2>

        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 block">
            Target Group
          </label>
          <select
            value={selectedGroupId}
            onChange={(e) => handleGroupChange(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:border-blue-500 transition-colors"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {selectedGroup && (
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-2 block">
              Split Amongst ({selectedParticipantIds.length} members)
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedGroup.members.map((m) => {
                const isSelected = selectedParticipantIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleParticipant(m.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-transparent hover:bg-gray-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {m.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 block">
              Paid By
            </label>
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-medium outline-none"
            >
              {selectedGroup?.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === currentUserId ? "You" : m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 block">
              Split Mode
            </label>
            <select
              value={splitMethod}
              onChange={(e) => setSplitMethod(e.target.value as any)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-medium outline-none"
            >
              <option value="EQUAL">Equally</option>
              <option value="EXACT">Exact (Auto-pro-rated)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Confirmation CTA */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPending}
          className="flex-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-semibold py-3.5 rounded-2xl text-sm transition-colors disabled:opacity-50"
        >
          Dismiss Scan
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending || !selectedGroupId}
          className="flex-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 px-6 rounded-2xl text-sm transition-colors shadow-sm shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CheckCircle2 size={16} />
              Confirm & Create Expense
            </>
          )}
        </button>
      </div>
    </div>
  )
}
