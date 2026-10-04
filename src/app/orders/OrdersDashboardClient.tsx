"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { paiseToInr } from "@/domain/money"
import { createOrderImport } from "@/actions/orderImport"
import { parseGenericOrder } from "@/services/orderParser"
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Plus,
  UtensilsCrossed,
  Sparkles,
  Loader2,
} from "lucide-react"

export function OrdersDashboardClient({
  pendingOrders,
  confirmedOrders,
  dismissedOrders,
}: {
  pendingOrders: any[]
  confirmedOrders: any[]
  dismissedOrders: any[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"pending" | "confirmed" | "dismissed">("pending")
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [rawText, setRawText] = useState("")
  const [isPending, startTransition] = useTransition()
  const [importError, setImportError] = useState<string | null>(null)

  const handleQuickImport = () => {
    if (!rawText.trim()) return
    setImportError(null)

    startTransition(async () => {
      try {
        const parsed = parseGenericOrder(rawText)
        const res = await createOrderImport({
          provider: parsed.provider || "UNKNOWN",
          externalOrderId: parsed.externalOrderId || null,
          merchant: parsed.merchant || "Imported Order",
          orderDate: new Date().toISOString().split("T")[0],
          subtotalPaise: parsed.subtotalPaise || 0,
          taxPaise: parsed.taxPaise || 0,
          deliveryFeePaise: parsed.deliveryFeePaise || 0,
          discountPaise: parsed.discountPaise || 0,
          tipPaise: parsed.tipPaise || 0,
          totalPaise: parsed.totalPaise || 0,
          items: parsed.items || [],
          importSource: "MANUAL",
        })

        if (res.success && res.importId) {
          setShowPasteModal(false)
          setRawText("")
          router.push(`/orders/${res.importId}`)
        }
      } catch (err: any) {
        setImportError(err?.message || "Failed to parse and import order")
      }
    })
  }

  const currentList =
    activeTab === "pending"
      ? pendingOrders
      : activeTab === "confirmed"
      ? confirmedOrders
      : dismissedOrders

  return (
    <div className="space-y-5">
      {/* Action Header */}
      <div className="flex items-center justify-between">
        <div className="flex bg-gray-200/80 dark:bg-zinc-800/80 p-1 rounded-2xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === "pending"
                ? "bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 shadow-sm"
                : "text-gray-600 dark:text-zinc-400"
            }`}
          >
            Pending ({pendingOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("confirmed")}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === "confirmed"
                ? "bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 shadow-sm"
                : "text-gray-600 dark:text-zinc-400"
            }`}
          >
            Confirmed ({confirmedOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("dismissed")}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === "dismissed"
                ? "bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 shadow-sm"
                : "text-gray-600 dark:text-zinc-400"
            }`}
          >
            Dismissed ({dismissedOrders.length})
          </button>
        </div>

        <button
          onClick={() => setShowPasteModal(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all"
        >
          <Plus size={14} /> Import Order
        </button>
      </div>

      {/* Paste / Manual Import Drawer */}
      {showPasteModal && (
        <div className="bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-900/60 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Sparkles size={16} /> Paste Order Text or Email
            </h3>
            <button
              onClick={() => setShowPasteModal(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Paste the order confirmation text from Swiggy, Zomato, Blinkit, or Instamart. DuoPay will parse the merchant, items, and total.
          </p>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={4}
            placeholder="e.g. Swiggy Order #123456 from Domino's Pizza. Total: ₹840..."
            className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 text-xs outline-none focus:border-blue-500"
          />

          {importError && (
            <p className="text-xs text-red-500">{importError}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={handleQuickImport}
              disabled={isPending || !rawText.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 disabled:opacity-50"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Parse & Review
            </button>
          </div>
        </div>
      )}

      {/* Orders List */}
      {currentList.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-8 text-center space-y-3">
          <UtensilsCrossed size={36} className="mx-auto text-gray-400 dark:text-zinc-600" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-200">
            {activeTab === "pending"
              ? "No Pending Orders"
              : activeTab === "confirmed"
              ? "No Confirmed Orders Yet"
              : "No Dismissed Orders"}
          </h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-xs mx-auto">
            {activeTab === "pending"
              ? "Share orders from Swiggy or Zomato or paste order text to review and split them."
              : "Orders you confirm will show up here for historical tracking."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentList.map((order) => {
            const totalInr = order.totalPaise ? paiseToInr(order.totalPaise) : 0
            const itemCount = order.items?.length || 0

            return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 rounded-2xl p-4 transition-all shadow-sm group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-xs uppercase">
                      {order.provider.slice(0, 3)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {order.merchant || "Order"}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                        <span className="capitalize">{order.provider.toLowerCase()}</span>
                        <span>•</span>
                        <span>{itemCount > 0 ? `${itemCount} items` : "Unitemized"}</span>
                        {order.orderDate && (
                          <>
                            <span>•</span>
                            <span>{new Date(order.orderDate).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-gray-900 dark:text-zinc-100">
                      ₹{totalInr.toFixed(2)}
                    </span>
                    <ChevronRight
                      size={18}
                      className="text-gray-400 group-hover:translate-x-0.5 transition-transform"
                    />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
