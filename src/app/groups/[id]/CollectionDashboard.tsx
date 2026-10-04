import Link from "next/link"
import { Calendar, Receipt, Camera, Target } from "lucide-react"
import GroupExpenseList from "./GroupExpenseList"

export default function CollectionDashboard({ group, totalSpending, oweBalances, owedBalances, netAmount, userId }: any) {
  const isOwed = netAmount > 0
  const owes = netAmount < 0

  const targetAmount = group.targetAmount || 0
  const progress = targetAmount > 0 ? Math.min(100, (totalSpending / targetAmount) * 100) : 0

  return (
    <div className="flex-1 overflow-y-auto pb-32">
      <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
        
        {/* Collection Target Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Target Progress</h2>
              <div className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                <Target size={24} className="text-blue-500" />
                ₹{(totalSpending / 100).toLocaleString()} / ₹{(targetAmount / 100).toLocaleString()}
              </div>
            </div>
            {group.deadline && (
              <div className="text-right">
                <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Deadline</h2>
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                  <Calendar size={18} className="text-slate-400" />
                  {new Date(group.deadline).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
          
          <div className="relative z-10">
            <div className="flex justify-between text-sm font-medium text-slate-500 mb-2">
              <span>{progress.toFixed(0)}% Complete</span>
              <span>₹{((targetAmount - totalSpending) / 100).toLocaleString()} left</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3">
              <div 
                className="bg-blue-500 h-3 rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* User Balance Card */}
        <div className={`p-5 rounded-3xl border shadow-sm ${
          isOwed ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50' : 
          owes ? 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50' : 
          'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
        }`}>
          <p className={`text-[13px] font-semibold uppercase tracking-wide mb-1 ${
            isOwed ? 'text-emerald-600/80 dark:text-emerald-500/80' : 
            owes ? 'text-red-600/80 dark:text-red-500/80' : 
            'text-slate-500 dark:text-slate-400'
          }`}>
            Your Contribution Status
          </p>
          <p className={`text-2xl font-bold ${
            isOwed ? 'text-emerald-700 dark:text-emerald-400' : 
            owes ? 'text-red-700 dark:text-red-400' : 
            'text-slate-900 dark:text-white'
          }`}>
            {isOwed ? '+' : owes ? '-' : ''}₹{(Math.abs(netAmount) / 100).toLocaleString()}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Link 
            href={`/expenses/add?groupId=${group.id}`} 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-2xl text-center transition-all shadow-sm shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2"
          >
            <Receipt size={18} />
            Contribute
          </Link>
          <button className="flex-1 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-semibold py-3.5 px-4 rounded-2xl text-center transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer">
            <Camera size={18} />
            Scan Receipt
          </button>
        </div>

        {/* Contributions List */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm sm:p-5">
          <div className="p-4 sm:p-0 mb-4 sm:mb-6 flex justify-between items-center">
            <h2 className="text-[17px] font-bold text-slate-900 dark:text-white">Recent Contributions</h2>
          </div>
          <GroupExpenseList expenses={group.expenses} currentUserId={userId} />
        </div>
      </div>
    </div>
  )
}
