import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Calendar, AlertCircle, Clock, ChevronRight, CheckCircle2 } from "lucide-react"
import BottomNav from "@/components/navigation/BottomNav"
import BillActions from "./BillActions"

export const metadata = {
  title: "Upcoming Bills | DuoPay",
}

export default async function BillsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const expenses = await prisma.expense.findMany({
    where: {
      status: "UPCOMING",
      dueDate: { not: null },
      OR: [
        { payerId: userId },
        { participants: { some: { userId } } }
      ]
    },
    include: {
      payer: { select: { id: true, name: true, image: true } },
      group: { select: { id: true, name: true } },
      participants: { select: { userId: true, share: true } }
    },
    orderBy: { dueDate: "asc" }
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const endOfWeek = new Date(today)
  endOfWeek.setDate(today.getDate() + 7)

  const overdue: typeof expenses = []
  const dueToday: typeof expenses = []
  const dueThisWeek: typeof expenses = []
  const upcoming: typeof expenses = []

  expenses.forEach(expense => {
    const due = new Date(expense.dueDate!)
    due.setHours(0, 0, 0, 0)

    if (due < today) {
      overdue.push(expense)
    } else if (due.getTime() === today.getTime()) {
      dueToday.push(expense)
    } else if (due <= endOfWeek) {
      dueThisWeek.push(expense)
    } else {
      upcoming.push(expense)
    }
  })

  const formatAmount = (paise: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(paise / 100)
  }

  const ExpenseCard = ({ expense, icon: Icon, colorClass }: { expense: typeof expenses[0], icon: any, colorClass: string }) => {
    const isPayer = expense.payerId === userId
    const myShare = expense.participants.find(p => p.userId === userId)?.share || 0
    const displayAmount = isPayer ? expense.amount : myShare
    
    return (
      <div className="bg-[#1C1C1E] rounded-2xl p-4 shadow-xl border border-white/5 relative overflow-hidden group transition-all">
        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        
        <Link href={expense.group ? `/groups/${expense.group.id}` : "#"} className="block">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClass} bg-opacity-10 backdrop-blur-sm border border-white/10`}>
              <Icon className="w-6 h-6" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate text-lg tracking-tight">{expense.description}</h3>
              <p className="text-sm text-gray-400 truncate">
                {expense.group?.name || "Direct Bill"} • {expense.payer.name}
              </p>
            </div>
            
            <div className="text-right shrink-0">
              <div className={`font-bold text-lg tracking-tight ${isPayer ? 'text-emerald-400' : 'text-white'}`}>
                {formatAmount(displayAmount)}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 flex items-center justify-end gap-1">
                {new Date(expense.dueDate!).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                <ChevronRight className="w-3 h-3 opacity-50" />
              </div>
            </div>
          </div>
        </Link>

        {/* Action Buttons */}
        <BillActions expenseId={expense.id} />
      </div>
    )
  }

  const Section = ({ title, items, icon, colorClass }: { title: string, items: typeof expenses, icon: any, colorClass: string }) => {
    if (items.length === 0) return null
    return (
      <div className="mb-10">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-1">{title}</h2>
        <div className="space-y-4">
          {items.map(expense => (
            <ExpenseCard key={expense.id} expense={expense} icon={icon} colorClass={colorClass} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24 selection:bg-emerald-500/30">
      <header className="bg-black/80 backdrop-blur-xl px-4 pt-14 pb-4 sticky top-0 z-20 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <h1 className="text-2xl font-bold bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">Upcoming Bills</h1>
        </div>
      </header>

      <main className="p-5 max-w-lg mx-auto">
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">All caught up!</h2>
            <p className="text-gray-400 text-lg">No pending bills on your radar.</p>
          </div>
        ) : (
          <div className="pt-2">
            <Section title="Overdue" items={overdue} icon={AlertCircle} colorClass="text-red-400" />
            <Section title="Due Today" items={dueToday} icon={Clock} colorClass="text-orange-400" />
            <Section title="Due This Week" items={dueThisWeek} icon={Calendar} colorClass="text-blue-400" />
            <Section title="Later" items={upcoming} icon={Calendar} colorClass="text-gray-300" />
          </div>
        )}
      </main>

      {/* Override BottomNav styling or just include it (assuming BottomNav is styled globally or adaptively) */}
      <BottomNav activeTab="home" userImage={session.user.image} userName={session.user.name} />
    </div>
  )
}
