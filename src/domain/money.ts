export type Paise = number;

export function isValidMoney(amount: number): boolean {
  return Number.isInteger(amount) && amount >= 0;
}

export function inrToPaise(inr: number): Paise {
  return Math.round(inr * 100);
}

export function paiseToInr(paise: Paise): number {
  return paise / 100;
}

export function formatPaise(paise: Paise): string {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const formatted = (absPaise / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Calculates equal split among participants.
 * Deterministically distributes the remainder to the first N participants (sorted by ID to be stable).
 */
export function calculateEqualSplit(amount: Paise, participantIds: string[]): Record<string, Paise> {
  if (!isValidMoney(amount)) {
    throw new Error("Amount must be a positive integer (paise)");
  }
  if (participantIds.length === 0) {
    throw new Error("Must have at least one participant");
  }

  const sortedIds = [...participantIds].sort();
  const baseShare = Math.floor(amount / participantIds.length);
  const remainder = amount % participantIds.length;

  const shares: Record<string, Paise> = {};
  for (let i = 0; i < sortedIds.length; i++) {
    const id = sortedIds[i];
    shares[id] = baseShare + (i < remainder ? 1 : 0);
  }

  return shares;
}

/**
 * Calculates exact split.
 * Ensures the exact amounts sum exactly to the total amount.
 */
export function calculateExactSplit(amount: Paise, exactAmounts: Record<string, Paise>): Record<string, Paise> {
  if (!isValidMoney(amount)) {
    throw new Error("Amount must be a positive integer (paise)");
  }
  
  let sum = 0;
  const shares: Record<string, Paise> = {};
  
  for (const [userId, share] of Object.entries(exactAmounts)) {
    if (!isValidMoney(share)) {
      throw new Error(`Invalid share for user ${userId}`);
    }
    shares[userId] = share;
    sum += share;
  }

  if (sum !== amount) {
    throw new Error(`Total exact amounts (${sum}) do not sum up to the total expense amount (${amount})`);
  }

  return shares;
}

/**
 * Calculates percentage split.
 * Percentages should be represented such that sum equals 100.
 */
export function calculatePercentageSplit(amount: Paise, percentages: Record<string, number>): Record<string, Paise> {
  if (!isValidMoney(amount)) {
    throw new Error("Amount must be a positive integer (paise)");
  }

  let pctSum = 0;
  for (const pct of Object.values(percentages)) {
    if (pct < 0) throw new Error("Percentages cannot be negative");
    pctSum += pct;
  }

  if (Math.abs(pctSum - 100) > 0.001) { // Allowing tiny floating point drift, but generally should be 100
    throw new Error(`Percentages must sum to exactly 100, got ${pctSum}`);
  }

  const shares: Record<string, Paise> = {};
  const fractionalParts: { id: string, fractional: number, base: number }[] = [];
  
  let assigned = 0;

  for (const [userId, pct] of Object.entries(percentages)) {
    // Exact mathematical share
    const exactShare = (amount * pct) / 100;
    const baseShare = Math.floor(exactShare);
    const fractional = exactShare - baseShare;
    
    shares[userId] = baseShare;
    assigned += baseShare;
    
    fractionalParts.push({ id: userId, fractional, base: baseShare });
  }

  // Distribute remainder
  let remainder = amount - assigned;
  
  // Sort by highest fractional part to distribute remainder deterministically.
  // If tied, sort by ID to ensure determinism.
  fractionalParts.sort((a, b) => {
    if (Math.abs(b.fractional - a.fractional) > 0.0001) {
      return b.fractional - a.fractional;
    }
    return a.id.localeCompare(b.id);
  });

  for (let i = 0; i < remainder; i++) {
    shares[fractionalParts[i].id] += 1;
  }

  return shares;
}

/**
 * Calculates proportional shares split.
 */
export function calculateSharesSplit(amount: Paise, requestedShares: Record<string, number>): Record<string, Paise> {
  if (!isValidMoney(amount)) {
    throw new Error("Amount must be a positive integer (paise)");
  }

  let totalShares = 0;
  for (const share of Object.values(requestedShares)) {
    if (!Number.isInteger(share) || share < 1) {
      throw new Error("Shares must be positive integers");
    }
    totalShares += share;
  }

  if (totalShares === 0) {
    throw new Error("Total shares must be greater than 0");
  }

  const shares: Record<string, Paise> = {};
  const fractionalParts: { id: string, fractional: number, base: number }[] = [];
  
  let assigned = 0;

  for (const [userId, shareCount] of Object.entries(requestedShares)) {
    const exactShare = (amount * shareCount) / totalShares;
    const baseShare = Math.floor(exactShare);
    const fractional = exactShare - baseShare;
    
    shares[userId] = baseShare;
    assigned += baseShare;
    
    fractionalParts.push({ id: userId, fractional, base: baseShare });
  }

  let remainder = amount - assigned;
  
  fractionalParts.sort((a, b) => {
    if (Math.abs(b.fractional - a.fractional) > 0.0001) {
      return b.fractional - a.fractional;
    }
    return a.id.localeCompare(b.id);
  });

  for (let i = 0; i < remainder; i++) {
    shares[fractionalParts[i].id] += 1;
  }

  return shares;
}

export interface ExpenseRecord {
  payerId: string;
  participants: { userId: string; share: Paise }[];
}

export interface SettlementRecord {
  payerId: string;
  receiverId: string;
  amount: Paise;
}

export function calculateNetBalances(
  expenses: ExpenseRecord[],
  settlements: SettlementRecord[]
): Record<string, Record<string, Paise>> {
  const positions: Record<string, Record<string, Paise>> = {};

  const addPosition = (creditor: string, debtor: string, amount: Paise) => {
    if (creditor === debtor) return;
    if (!positions[creditor]) positions[creditor] = {};
    if (!positions[debtor]) positions[debtor] = {};
    
    positions[creditor][debtor] = (positions[creditor][debtor] || 0) + amount;
    positions[debtor][creditor] = (positions[debtor][creditor] || 0) - amount;
  };

  for (const expense of expenses) {
    for (const participant of expense.participants) {
      if (participant.userId !== expense.payerId) {
        addPosition(expense.payerId, participant.userId, participant.share);
      }
    }
  }

  for (const settlement of settlements) {
    addPosition(settlement.payerId, settlement.receiverId, settlement.amount);
  }

  return positions;
}
