import { calculateEqualSplit } from "./money"

export interface ItemSplitAssignment {
  itemId: string
  name: string
  amountPaise: number
  assignedUserIds: string[]
}

export interface ReconciledSplitResult {
  shares: Record<string, number>
  totalPaise: number
  isExactMatch: boolean
}

/**
 * Deterministically reconciles itemized splits into participant shares.
 * Invariant guarantee: SUM(participant shares) === totalPaise.
 * Any single paise rounding discrepancies from fractional division are
 * deterministically attributed to the largest assignees.
 */
export function reconcileItemizedSplit(
  items: ItemSplitAssignment[],
  totalPaise: number
): ReconciledSplitResult {
  const shares: Record<string, number> = {}

  for (const item of items) {
    if (item.assignedUserIds.length === 0) continue

    const split = calculateEqualSplit(item.amountPaise, item.assignedUserIds)
    for (const [userId, share] of Object.entries(split)) {
      shares[userId] = (shares[userId] || 0) + share
    }
  }

  const computedTotal = Object.values(shares).reduce((a, b) => a + b, 0)
  const diff = totalPaise - computedTotal

  // If there is any tiny rounding difference due to unassigned pennies or split rounding:
  if (diff !== 0 && Object.keys(shares).length > 0) {
    const userKeys = Object.keys(shares).sort((a, b) => shares[b] - shares[a])
    // Distribute remaining paise deterministically
    shares[userKeys[0]] += diff
  }

  const finalTotal = Object.values(shares).reduce((a, b) => a + b, 0)

  return {
    shares,
    totalPaise: finalTotal,
    isExactMatch: finalTotal === totalPaise,
  }
}
