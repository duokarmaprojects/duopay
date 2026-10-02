"use client"

import { useState } from "react"
import { Activity, Receipt, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { ExpenseIcon } from "@/components/expenses/ExpenseIcon"

export type ActivityItem = {
  id: string
  type: 'EXPENSE' | 'SETTLEMENT'
  amount: number
  description: string
  category?: string | null
  groupName?: string
  date: string
  isUserPayer: boolean
  payerName: string
  receiverName?: string
}

type Props = {
  activities: ActivityItem[]
}

function groupActivitiesByDate(activities: ActivityItem[]) {
  const groups: { [key: string]: ActivityItem[] } = {}
  
  activities.forEach(activity => {
    const d = new Date(activity.date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    let label = d.toLocaleDateString()
    if (d.toDateString() === today.toDateString()) {
      label = "TODAY"
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = "YESTERDAY"
    }
    
    if (!groups[label]) groups[label] = []
    groups[label].push(activity)
  })
  
  return groups
}

export default function ActivityFeed({ activities }: Props) {
  const [filter, setFilter] = useState<'ALL' | 'EXPENSES' | 'SETTLEMENTS'>('ALL')

  if (activities.length === 0) {
    return (
      <div className="p-6 pt-4 flex justify-center">
        <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm w-full max-w-sm">
          <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <Activity size={24} />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">No recent activity</h3>
          <p className="text-sm text-gray-500 mb-2 px-4">Your expenses and settlements will appear here.</p>
        </div>
      </div>
    )
  }

  const filtered = activities.filter(a => {
    if (filter === 'EXPENSES') return a.type === 'EXPENSE'
    if (filter === 'SETTLEMENTS') return a.type === 'SETTLEMENT'
    return true
  })

  const grouped = groupActivitiesByDate(filtered)

  return (
    <div className="p-6 pt-2 pb-24">
      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        {(['ALL', 'EXPENSES', 'SETTLEMENTS'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f 
                ? 'bg-black text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="flex flex-col gap-6">
        {Object.entries(grouped).map(([dateLabel, items]) => (
          <div key={dateLabel}>
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">{dateLabel}</h2>
            <div className="flex flex-col gap-3">
              {items.map(item => (
                <div key={item.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
                  {item.type === 'EXPENSE' ? (
                    <ExpenseIcon category={item.category} description={item.description} className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600">
                      <CheckCircle2 size={18} />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {item.type === 'EXPENSE' ? (
                        <>
                          {item.isUserPayer ? 'You' : item.payerName} paid <span className="text-gray-900">₹{item.amount / 100}</span>
                        </>
                      ) : (
                        <>
                          {item.isUserPayer ? 'You' : item.payerName} settled <span className="text-gray-900">₹{item.amount / 100}</span> with {item.isUserPayer ? item.receiverName : 'you'}
                        </>
                      )}
                    </p>
                    {item.type === 'EXPENSE' && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {item.description} {item.groupName && `• ${item.groupName}`}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
