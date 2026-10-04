"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, Users, Search, ChevronRight } from "lucide-react"
import { GroupIcon } from "@/components/ui/GroupIcon"

interface GroupData {
  id: string
  name: string
  image: string | null
  type: string
  destination: string | null
  startDate: string | null
  endDate: string | null
  targetAmount: number | null
  deadline: string | null
  poolOwnerId: string | null
  memberCount: number
  netAmount: number
  totalSpent: number
}

interface Props {
  groups: GroupData[]
}

export default function GroupsListClient({ groups }: Props) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const trips = filteredGroups.filter(g => g.type === 'TRIP')
  const collections = filteredGroups.filter(g => g.type === 'COLLECTION')
  const standardGroups = filteredGroups.filter(g => g.type === 'GROUP' || !g.type)

  const renderGroupCard = (group: GroupData) => {
    const isOwed = group.netAmount > 0
    const owes = group.netAmount < 0
    const isSettled = group.netAmount === 0

    return (
      <Link
        key={group.id}
        href={`/groups/${group.id}`}
        className="group/card bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-100 dark:hover:border-blue-900/30 flex items-center gap-4 transition-all active:scale-[0.98]"
      >
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white shrink-0 shadow-inner overflow-hidden border border-slate-100 dark:border-slate-700/50">
          <GroupIcon iconId={group.image} size={32} />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white text-[17px] truncate mb-1 group-hover/card:text-blue-600 dark:group-hover/card:text-blue-400 transition-colors">
            {group.name}
          </h3>
          <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <Users size={14} className="opacity-70" />
              {group.memberCount} members
            </span>
            {group.type === 'TRIP' && group.destination && (
              <span className="truncate max-w-[120px]">&bull; {group.destination}</span>
            )}
            {group.type === 'COLLECTION' && group.targetAmount && (
              <span className="font-medium text-blue-600 dark:text-blue-400">
                &bull; Target: ₹{(group.targetAmount / 100).toLocaleString()}
              </span>
            )}
          </div>
          {group.type === 'COLLECTION' && group.targetAmount && (
            <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
              <div 
                className="bg-blue-500 h-1.5 rounded-full" 
                style={{ width: `${Math.min(100, (group.totalSpent / group.targetAmount) * 100)}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2">
          <div className="text-right">
            {isOwed && (
              <>
                <p className="text-[11px] sm:text-xs font-semibold text-emerald-600/80 dark:text-emerald-500/80 uppercase tracking-wide">You are owed</p>
                <p className="text-[15px] sm:text-base font-bold text-emerald-600 dark:text-emerald-400">₹{(Math.abs(group.netAmount) / 100).toFixed(0)}</p>
              </>
            )}
            {owes && (
              <>
                <p className="text-[11px] sm:text-xs font-semibold text-red-500/80 dark:text-red-400/80 uppercase tracking-wide">You owe</p>
                <p className="text-[15px] sm:text-base font-bold text-red-600 dark:text-red-500">₹{(Math.abs(group.netAmount) / 100).toFixed(0)}</p>
              </>
            )}
            {isSettled && (
              <>
                <p className="text-[11px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Status</p>
                <p className="text-[15px] sm:text-base font-semibold text-slate-600 dark:text-slate-400">Settled up</p>
              </>
            )}
          </div>
          <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 group-hover/card:text-blue-500 group-hover/card:translate-x-0.5 transition-all" />
        </div>
      </Link>
    )
  }

  return (
    <div className="p-4 sm:p-6 pb-32 max-w-3xl mx-auto w-full">
      {/* Header and Search */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Groups
          </h1>
          <Link
            href="/groups/create"
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-blue-200 dark:shadow-none"
          >
            <Plus size={18} className="stroke-[3]" />
            <span className="hidden sm:inline">Create</span>
          </Link>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-3.5 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center border border-slate-100 dark:border-slate-800 shadow-sm mt-4">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={28} />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-lg mb-2">
            No groups yet
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
            Create your first group to start splitting expenses with friends, family, or roommates.
          </p>
          <Link
            href="/groups/create"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-sm"
          >
            <Plus size={20} />
            Create a Group
          </Link>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">No groups match your search.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {trips.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Trips</h2>
              <div className="grid gap-3 sm:gap-4">
                {trips.map(renderGroupCard)}
              </div>
            </div>
          )}
          {collections.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Collections</h2>
              <div className="grid gap-3 sm:gap-4">
                {collections.map(renderGroupCard)}
              </div>
            </div>
          )}
          {standardGroups.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Groups</h2>
              <div className="grid gap-3 sm:gap-4">
                {standardGroups.map(renderGroupCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
