"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { confirmOrderImport, dismissOrderImport } from "@/actions/orderImport"
import { NormalizedOrder, reconcileOrder } from "@/domain/orderImport"
import { paiseToInr, inrToPaise } from "@/domain/money"
import {
  AlertTriangle,
  ShoppingBag,
  Store,
  Calendar,
  CheckCircle2,
  XCircle,
  Users,
  Loader2,
  Plus,
  Trash2,
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

export function OrderDetailClient({
  order,
  groups,
  currentUserId,
}: {
  order: any
  groups: Group[]
  currentUserId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [acknowledgeWarning, setAcknowledgeWarning] = useState(false)

  const [merchant, setMerchant] = useState(order.merchant || "Order Expense")
  const [date, setDate] = useState(
    order.orderDate
      ? new Date(order.orderDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  )

  const initialTotalPaise = order.totalPaise ?? 0
  const [totalInr, setTotalInr] = useState(paiseToInr(initialTotalPaise).toString())
  const [taxInr, setTaxInr] = useState(
    order.taxPaise ? paiseToInr(order.taxPaise).toString() : "0"
  )
  const [deliveryInr, setDeliveryInr] = useState(
    order.deliveryFeePaise ? paiseToInr(order.deliveryFeePaise).toString() : "0"
  )
  const [discountInr, setDiscountInr] = useState(
    order.discountPaise ? paiseToInr(order.discountPaise).toString() : "0"
  )
  const [category, setCategory] = useState("FOOD")

  // Items
  const [items, setItems] = useState<ItemRow[]>(() => {
    if (order.items && order.items.length > 0) {
      return order.items.map((i: any) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity || 1,
        priceInr: i.lineTotalPaise ? paiseToInr(i.lineTotalPaise).toString() : "0",
      }))
    }
    return []
  })

  // Group selection
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || "")
  const selectedGroup = groups.find((g) => g.id === selectedGroupId)
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(() => {
    return groups[0]?.members.map((m) => m.id) || [currentUserId]
  })
  const [payerId, setPayerId] = useState(currentUserId)
  const [splitMethod, setSplitMethod] = useState<"EQUAL" | "EXACT">("EQUAL")

  // Math & Reconciliation
  const itemsTotalPaise = useMemo(() => {
    return items.reduce((sum, item) => sum + inrToPaise(parseFloat(item.priceInr) || 0), 0)
  }, [items])

  const parsedTotalPaise = inrToPaise(parseFloat(totalInr) || 0)
  const parsedTaxPaise = inrToPaise(parseFloat(taxInr) || 0)
  const parsedDeliveryPaise = inrToPaise(parseFloat(deliveryInr) || 0)
  const parsedDiscountPaise = inrToPaise(parseFloat(discountInr) || 0)

  const computedTotalPaise = itemsTotalPaise + parsedTaxPaise + parsedDeliveryPaise - parsedDiscountPaise
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
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: val } : i)))
  }

  const toggleParticipant = (pid: string) => {
    if (selectedParticipantIds.includes(pid)) {
      if (selectedParticipantIds.length > 1) {
        setSelectedParticipantIds(selectedParticipantIds.filter((id) => id !== pid))
      }
    } else {
      setSelectedParticipantIds([...selectedParticipantIds, pid])
    }
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
    if (hasReconciliationWarning && !acknowledgeWarning) {
      setErrorMsg("Please acknowledge the reconciliation mismatch warning before confirming")
      return
    }

    setErrorMsg(null)
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.set("importId", order.id)
        formData.set("groupId", selectedGroupId)
        formData.set("description", merchant)
        formData.set("amount", totalInr)
        formData.set("payerId", payerId)
        formData.set("splitMethod", splitMethod)
        formData.set("category", category)
        formData.set("acknowledgeWarning", acknowledgeWarning ? "true" : "false")

        selectedParticipantIds.forEach((pid) => {
          formData.append("participants", pid)
        })

        if (items.length > 0) {
          const payload = items.map((i) => ({
            name: i.name,
            price: inrToPaise(parseFloat(i.priceInr) || 0),
            quantity: i.quantity,
          }))
          formData.set("receiptItems", JSON.stringify(payload))
        }

        await confirmOrderImport(formData)
        router.push(`/groups/${selectedGroupId}`)
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to confirm order expense")
      }
    })
  }

  const handleDismiss = () => {
    startTransition(async () => {
      try {
        await dismissOrderImport(order.id)
        router.push("/orders")
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to dismiss order")
      }
    })
  }

  const isConfirmed = order.status === "CONFIRMED"

  return (
    <div className="space-y-6">
      {isConfirmed && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="font-semibold">This order has already been confirmed as an expense.</p>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 p-4 rounded-2xl flex items-center gap-3 text-sm">
          <XCircle size={18} className="shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Order Info Card */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-xs uppercase">
              {order.provider.slice(0, 3)}
            </span>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {order.provider} Order
            </span>
          </div>
          {order.externalOrderId && (
            <span className="text-xs text-gray-400 font-mono">#{order.externalOrderId}</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <Store size={14} /> Merchant / Restaurant
            </label>
            <input
              type="text"
              value={merchant}
              disabled={isConfirmed}
              onChange={(e) => setMerchant(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:border-blue-500 transition-colors disabled:opacity-60"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <Calendar size={14} /> Date
            </label>
            <input
              type="date"
              value={date}
              disabled={isConfirmed}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:border-blue-500 transition-colors disabled:opacity-60"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 block">
              Total (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={totalInr}
              disabled={isConfirmed}
              onChange={(e) => setTotalInr(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-base font-bold outline-none text-blue-600 dark:text-blue-400 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 block">
              Taxes (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={taxInr}
              disabled={isConfirmed}
              onChange={(e) => setTaxInr(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 block">
              Delivery (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={deliveryInr}
              disabled={isConfirmed}
              onChange={(e) => setDeliveryInr(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium outline-none disabled:opacity-60"
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
              disabled={isConfirmed}
              onChange={(e) => setDiscountInr(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium outline-none disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* Reconciliation warning */}
      {hasReconciliationWarning && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold mb-0.5">Order Math Mismatch</p>
              <p>
                Sum of items (₹{(itemsTotalPaise / 100).toFixed(2)}) + Taxes (₹{taxInr}) + Delivery (₹{deliveryInr}) - Discount (₹{discountInr}) = ₹{(computedTotalPaise / 100).toFixed(2)}, which does not match stated Total ₹{totalInr}.
              </p>
            </div>
          </div>

          {!isConfirmed && (
            <label className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={acknowledgeWarning}
                onChange={(e) => setAcknowledgeWarning(e.target.checked)}
                className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              />
              I acknowledge the discrepancy and wish to proceed with the entered total.
            </label>
          )}
        </div>
      )}

      {/* Line Items Card */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
            Items ({items.length})
          </h2>
          {!isConfirmed && (
            <button
              type="button"
              onClick={addItem}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <Plus size={14} /> Add Item
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-zinc-400 py-2">
            No line items parsed. Expense will be recorded as unitemized.
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
                  disabled={isConfirmed}
                  onChange={(e) => updateItem(item.id, "name", e.target.value)}
                  className="flex-1 bg-transparent text-sm font-medium outline-none disabled:opacity-60"
                  placeholder="Item description"
                />
                <div className="flex items-center gap-1 w-24">
                  <span className="text-xs text-gray-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={item.priceInr}
                    disabled={isConfirmed}
                    onChange={(e) => updateItem(item.id, "priceInr", e.target.value)}
                    className="w-full bg-transparent text-sm font-semibold outline-none text-right disabled:opacity-60"
                  />
                </div>
                {!isConfirmed && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Group & Split Selection */}
      {!isConfirmed && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Users size={16} /> Split In Group
          </h2>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 block">
              Group
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
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
      )}

      {/* CTAs */}
      {!isConfirmed && (
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isPending}
            className="flex-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-semibold py-3.5 rounded-2xl text-sm transition-colors disabled:opacity-50"
          >
            Dismiss
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
                Confirm & Split Order
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
