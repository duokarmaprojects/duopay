"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export interface ExportDataPayload {
  exportedAt: string
  user: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
  }
  expenses: Array<{
    id: string
    description: string
    amountInr: string
    category: string | null
    date: string
    groupName: string | null
    isPayer: boolean
    payerName: string | null
    userShareInr: string
  }>
  settlements: Array<{
    id: string
    amountInr: string
    status: string
    paymentStatus: string
    date: string
    groupName: string | null
    isPayer: boolean
    payerName: string | null
    receiverName: string | null
  }>
}

/**
 * Server-authoritative data exporter.
 * Strictly scopes data to the authenticated session user.
 * Generates structured JSON or CSV format.
 */
export async function exportUserData(format: "JSON" | "CSV" = "JSON"): Promise<{
  data: string
  filename: string
  mimeType: string
}> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true },
  })

  if (!user) throw new Error("User not found")

  // Authorized Expenses
  const expenses = await prisma.expense.findMany({
    where: {
      OR: [
        { payerId: userId },
        { participants: { some: { userId } } },
      ],
    },
    include: {
      payer: { select: { name: true } },
      group: { select: { name: true } },
      participants: { where: { userId }, select: { share: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  // Authorized Settlements
  const settlements = await prisma.settlement.findMany({
    where: {
      OR: [{ payerId: userId }, { receiverId: userId }],
    },
    include: {
      payer: { select: { name: true } },
      receiver: { select: { name: true } },
      group: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const formattedExpenses = expenses.map((e) => {
    const userShare = e.participants[0]?.share ?? (e.payerId === userId ? e.amount : 0)
    return {
      id: e.id,
      description: e.description,
      amountInr: (e.amount / 100).toFixed(2),
      category: e.category || "OTHER",
      date: e.createdAt.toISOString().slice(0, 10),
      groupName: e.group?.name || "Direct",
      isPayer: e.payerId === userId,
      payerName: e.payer.name,
      userShareInr: (userShare / 100).toFixed(2),
    }
  })

  const formattedSettlements = settlements.map((s) => ({
    id: s.id,
    amountInr: (s.amount / 100).toFixed(2),
    status: s.status,
    paymentStatus: s.paymentStatus,
    date: s.createdAt.toISOString().slice(0, 10),
    groupName: s.group?.name || "Direct",
    isPayer: s.payerId === userId,
    payerName: s.payer.name,
    receiverName: s.receiver.name,
  }))

  const dateTag = new Date().toISOString().slice(0, 10)

  if (format === "CSV") {
    // Generate CSV
    const csvRows: string[] = []
    csvRows.push("Date,Type,Description,Category,Group,Total (INR),Your Share (INR),Status")

    for (const exp of formattedExpenses) {
      csvRows.push(
        `"${exp.date}","Expense","${exp.description.replace(/"/g, '""')}","${exp.category}","${(exp.groupName || "").replace(/"/g, '""')}",${exp.amountInr},${exp.userShareInr},"Recorded"`
      )
    }

    for (const st of formattedSettlements) {
      csvRows.push(
        `"${st.date}","Settlement","${st.isPayer ? "Paid to " + (st.receiverName || "") : "Received from " + (st.payerName || "")}","TRANSFER","${(st.groupName || "").replace(/"/g, '""')}",${st.amountInr},${st.amountInr},"${st.paymentStatus}"`
      )
    }

    return {
      data: csvRows.join("\n"),
      filename: `duopay-statement-${dateTag}.csv`,
      mimeType: "text/csv;charset=utf-8;",
    }
  }

  // JSON format
  const payload: ExportDataPayload = {
    exportedAt: new Date().toISOString(),
    user,
    expenses: formattedExpenses,
    settlements: formattedSettlements,
  }

  return {
    data: JSON.stringify(payload, null, 2),
    filename: `duopay-export-${dateTag}.json`,
    mimeType: "application/json;charset=utf-8;",
  }
}
