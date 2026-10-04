import Link from "next/link"
import { Users, Calendar, MapPin, Receipt, Camera, PieChart } from "lucide-react"
import { GroupIcon } from "@/components/ui/GroupIcon"
import GroupSmartSettleButton from "./GroupSmartSettleButton"
import GroupExpenseList from "./GroupExpenseList"

export default function TripDashboard({ group, totalSpending, oweBalances, owedBalances, netAmount, userId }: any) {
  const isOwed = netAmount > 0
  const owes = netAmount < 0

  return (
    <div className="flex-1 overflow-y-auto pb-32">
      <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-sm font-medium text-blue-100 uppercase tracking-wider mb-1">Trip Destination</h2>
              <div className="flex items-center gap-2 text-2xl font-bold">
                <MapPin size={24} className="text-blue-200" />
                {group.destination || "TBD"}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-sm font-medium text-blue-100 uppercase tracking-wider mb-1">Dates</h2>
              <div className="flex items-center gap-2 font-semibold">
                <Calendar size={18} className="text-blue-200" />
                {group.startDate ? new Date(group.startDate).toLocaleDateString() : "TBD"} 
                {group.endDate && ` - ${new Date(group.endDate).toLocaleDateString()}`}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-sm text-blue-100 mb-1">Total Trip Cost</p>
              <p className="text-3xl font-bold">₹{(totalSpending / 100).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-100 mb-1">Your Balance</p>
              <p className={`text-xl font-bold ${isOwed ? 'text-emerald-300' : owes ? 'text-red-300' : 'text-white'}`}>
                {isOwed ? '+' : owes ? '-' : ''}₹{(Math.abs(netAmount) / 100).toLocaleString()}
              </p>
            </div>
          </div>

          {group.targetAmount && (
            <div className="mt-6 pt-4 border-t border-white/20">
              <div className="flex justify-between text-sm font-medium text-blue-100 mb-2">
                <span>Pool Progress</span>
                <span>₹{(totalSpending / 100).toLocaleString()} / ₹{(group.targetAmount / 100).toLocaleString()}</span>
              </div>
              <div className="w-full bg-blue-900/50 rounded-full h-2">
                <div 
                  className="bg-blue-300 h-2 rounded-full" 
                  style={{ width: `${Math.min(100, (totalSpending / group.targetAmount) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <Link 
            href={`/expenses/add?groupId=${group.id}`} 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-2xl text-center transition-all shadow-sm shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2"
          >
            <Receipt size={18} />
            Add Expense
          </Link>
          <button className="flex-1 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-semibold py-3.5 px-4 rounded-2xl text-center transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer">
            <Camera size={18} />
            Scan Receipt
          </button>
        </div>

        {/* Settle Up Section */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Settlements</h2>
            <GroupSmartSettleButton groupId={group.id} />
          </div>
          
          {oweBalances.length === 0 && owedBalances.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <PieChart size={24} />
              </div>
              <p className="text-emerald-600 dark:text-emerald-400 font-semibold">You're all settled up!</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">No pending balances for this trip.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {oweBalances.map((b: any) => (
                <div key={b.userId} className="flex items-center justify-between p-4 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">You owe <span className="font-semibold text-slate-900 dark:text-white">{b.user.name}</span></p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-500">₹{(b.amount / 100).toFixed(0)}</p>
                  </div>
                  <Link href={`/settle?userId=${b.userId}&groupId=${group.id}`} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
                    Settle
                  </Link>
                </div>
              ))}
              
              {owedBalances.map((b: any) => (
                <div key={b.userId} className="flex items-center justify-between p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400"><span className="font-semibold text-slate-900 dark:text-white">{b.user.name}</span> owes you</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-500">₹{(b.amount / 100).toFixed(0)}</p>
                  </div>
                  <div className="px-4 py-2 bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-semibold">
                    Waiting
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expenses List */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm sm:p-5">
          <GroupExpenseList expenses={group.expenses} currentUserId={userId} />
        </div>
      </div>
    </div>
  )
}
