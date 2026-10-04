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
        className="flex items-center gap-1.5 bg-amber-100/50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors border border-amber-200/50 dark:border-amber-800/50"
      >
        <Sparkles size={14} />
        Smart Settle
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
