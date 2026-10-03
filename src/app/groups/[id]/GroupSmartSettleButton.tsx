"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import SmartSettleModal from "@/components/settlement/SmartSettleModal"
import { getSmartSettlementPlanAction } from "@/actions/settlement"

export default function GroupSmartSettleButton({ groupId }: { groupId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleOpen = async () => {
    setIsOpen(true)
    setLoading(true)
    try {
      const p = await getSmartSettlementPlanAction(groupId)
      setPlan(p)
    } catch (e) {
      console.error("Failed to load group smart plan:", e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="w-full mt-3 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent hover:from-amber-500/25 border border-amber-500/30 rounded-xl p-2.5 flex items-center justify-between text-left transition-all active:scale-[0.99] group shadow-xs"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <Sparkles size={15} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-1.5">
              Smart Settle Group
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                Simplify
              </span>
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform mr-1">
          Review →
        </span>
      </button>

      <SmartSettleModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        plan={plan}
        isLoading={loading}
        onRefresh={handleOpen}
      />
    </>
  )
}
