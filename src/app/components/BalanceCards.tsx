"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"

type DetailedBalance = {
  userId: string
  userName: string
  amount: number
  type: 'OWED_TO_USER' | 'USER_OWES'
}

type Props = {
  totalUserOwes: number
  totalOwedToUser: number
  detailedBalances: DetailedBalance[]
  privacyMode?: boolean
}

export default function BalanceCards({ totalUserOwes, totalOwedToUser, detailedBalances, privacyMode = false }: Props) {
  const [expandedCard, setExpandedCard] = useState<'owe' | 'owed' | null>(null)

  const oweBalances = detailedBalances.filter(b => b.type === 'USER_OWES')
  const owedBalances = detailedBalances.filter(b => b.type === 'OWED_TO_USER')

  const toggleCard = (card: 'owe' | 'owed') => {
    setExpandedCard(prev => (prev === card ? null : card))
  }

  const formatMoney = (amountInPaise: number) => {
    return privacyMode ? '••••' : `₹${amountInPaise / 100}`
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* YOU OWE Card */}
      <div 
        className="bg-red-50 rounded-2xl border border-red-100 overflow-hidden transition-all duration-300 cursor-pointer"
        onClick={() => toggleCard('owe')}
      >
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-600 mb-1 uppercase tracking-wide">
              {expandedCard === 'owe' ? `You Owe — ${formatMoney(totalUserOwes)}` : 'You Owe'}
            </p>
            {expandedCard !== 'owe' && (
              <p className="text-2xl font-bold text-gray-900">{formatMoney(totalUserOwes)}</p>
            )}
          </div>
          <div className="text-red-600 transition-transform duration-300">
            {expandedCard === 'owe' ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </div>
        </div>

        {/* Expanded Content */}
        <div 
          className={`px-4 overflow-hidden transition-all duration-300 ease-in-out ${
            expandedCard === 'owe' ? 'max-h-[500px] opacity-100 pb-4' : 'max-h-0 opacity-0 pb-0'
          }`}
        >
          {oweBalances.length === 0 ? (
            <div className="py-4 text-center text-sm font-medium text-red-600">
              You're all settled up 🎉
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {oweBalances.map(b => (
                <div key={b.userId} className="bg-white rounded-xl p-3 shadow-sm border border-red-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{b.userName} <span className="text-red-600 ml-1">{formatMoney(b.amount)}</span></p>
                    <p className="text-xs text-gray-500 mt-0.5">Context</p>
                  </div>
                  <Link 
                    href={`/settle?userId=${b.userId}&groupId=0`} 
                    onClick={(e) => e.stopPropagation()}
                    className="bg-black text-white px-4 py-2 rounded-lg text-xs font-semibold active:scale-95 transition-transform"
                  >
                    Pay Now
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* YOU'RE OWED Card */}
      <div 
        className="bg-emerald-50 rounded-2xl border border-emerald-100 overflow-hidden transition-all duration-300 cursor-pointer"
        onClick={() => toggleCard('owed')}
      >
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-600 mb-1 uppercase tracking-wide">
              {expandedCard === 'owed' ? `You're Owed — ${formatMoney(totalOwedToUser)}` : 'You\'re Owed'}
            </p>
            {expandedCard !== 'owed' && (
              <p className="text-2xl font-bold text-gray-900">{formatMoney(totalOwedToUser)}</p>
            )}
          </div>
          <div className="text-emerald-600 transition-transform duration-300">
            {expandedCard === 'owed' ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </div>
        </div>

        {/* Expanded Content */}
        <div 
          className={`px-4 overflow-hidden transition-all duration-300 ease-in-out ${
            expandedCard === 'owed' ? 'max-h-[500px] opacity-100 pb-4' : 'max-h-0 opacity-0 pb-0'
          }`}
        >
          {owedBalances.length === 0 ? (
            <div className="py-4 text-center text-sm font-medium text-emerald-600">
              You're all settled up 🎉
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {owedBalances.map(b => (
                <div key={b.userId} className="bg-white rounded-xl p-3 shadow-sm border border-emerald-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{b.userName} <span className="text-emerald-600 ml-1">{formatMoney(b.amount)}</span></p>
                    <p className="text-xs text-gray-500 mt-0.5">Context</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      alert("Reminder sent! (Demo)")
                    }}
                    className="bg-black text-white px-4 py-2 rounded-lg text-xs font-semibold active:scale-95 transition-transform"
                  >
                    Remind
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
