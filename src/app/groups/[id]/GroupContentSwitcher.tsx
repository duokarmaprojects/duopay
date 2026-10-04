"use client"

import { useState } from "react"
import { PieChart, MessageSquare } from "lucide-react"
import GroupChat from "./GroupChat"

interface Props {
  groupId: string
  groupName: string
  currentUserId: string
  overviewContent: React.ReactNode
}

export default function GroupContentSwitcher({
  groupId,
  groupName,
  currentUserId,
  overviewContent,
}: Props) {
  const [activeTab, setActiveTab] = useState<"FINANCES" | "CHAT">("FINANCES")

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tab Switcher */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-2 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center gap-2 z-10">
        <button
          onClick={() => setActiveTab("FINANCES")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === "FINANCES"
              ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <PieChart size={15} />
          <span>Finances</span>
        </button>

        <button
          onClick={() => setActiveTab("CHAT")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === "CHAT"
              ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <MessageSquare size={15} />
          <span>Group Chat</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "FINANCES" ? (
          overviewContent
        ) : (
          <GroupChat
            groupId={groupId}
            groupName={groupName}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  )
}
