import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Calendar, AlertCircle, Clock, ChevronRight, CheckCircle2 } from "lucide-react"
import BottomNav from "@/components/navigation/BottomNav"

export const metadata = {
  title: "Upcoming Bills | DuoPay",
}

export default async function BillsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const expenses = await prisma.expense.findMany({
    where: {
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
      <Link href={expense.group ? `/groups/${expense.group.id}` : "#"} className="block">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 transition-all active:scale-[0.98]">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClass}`}>
            <Icon className="w-6 h-6" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 truncate">{expense.description}</h3>
            <p className="text-sm text-gray-500">
              {expense.group?.name || "Direct Bill"} • {expense.payer.name}
            </p>
          </div>
          
          <div className="text-right">
            <div className={`font-bold ${isPayer ? 'text-emerald-600' : 'text-gray-900'}`}>
              {formatAmount(displayAmount)}
            </div>
            <div className="text-xs text-gray-400 mt-1 flex items-center justify-end gap-1">
              {new Date(expense.dueDate!).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </Link>
    )
  }

  const Section = ({ title, items, icon, colorClass }: { title: string, items: typeof expenses, icon: any, colorClass: string }) => {
    if (items.length === 0) return null
    return (
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4 px-1">{title}</h2>
        <div className="space-y-3">
          {items.map(expense => (
            <ExpenseCard key={expense.id} expense={expense} icon={icon} colorClass={colorClass} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white px-4 pt-12 pb-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Upcoming Bills</h1>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">All caught up!</h2>
            <p className="text-gray-500">You don't have any upcoming bills or dues.</p>
          </div>
        ) : (
          <>
            <Section title="Overdue" items={overdue} icon={AlertCircle} colorClass="bg-red-50 text-red-600" />
            <Section title="Due Today" items={dueToday} icon={Clock} colorClass="bg-orange-50 text-orange-600" />
            <Section title="Due This Week" items={dueThisWeek} icon={Calendar} colorClass="bg-blue-50 text-blue-600" />
            <Section title="Upcoming" items={upcoming} icon={Calendar} colorClass="bg-gray-100 text-gray-600" />
          </>
        )}
      </main>

      <BottomNav activeTab="home" userImage={session.user.image} userName={session.user.name} />
    </div>
  )
}
