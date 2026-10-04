import { auth, signOut } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { LogOut } from "lucide-react"
import { getUserBalances } from "@/services/balance"
import ProfileImageUpload from "./upload-form"
import SettingsList from "./SettingsList"
import { getUserSettings } from "@/actions/settings"
import { defaultUserSettings } from "@/domain/settings"
import BottomNav from "@/components/navigation/BottomNav"
import ProfileSections from "./ProfileSections"

export const metadata = {
  title: "Profile - DuoPay",
}

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) redirect('/login?expired=1')

  const [
    balancesData,
    groupCount,
    expenseCount,
    settlementCount,
    userSettings,
  ] = await Promise.all([
    getUserBalances(session.user.id).catch((err) => {
      console.error("[ProfilePage] Error fetching balances:", err)
      return { totalOwedToUser: 0, totalUserOwes: 0, detailedBalances: [] }
    }),
    prisma.groupMember.count({ where: { userId: session.user.id } }).catch((err) => {
      console.error("[ProfilePage] Error counting groups:", err)
      return 0
    }),
    prisma.expense.count({ 
      where: { 
        OR: [
          { payerId: session.user.id }, 
          { participants: { some: { userId: session.user.id } } }
        ] 
      } 
    }).catch((err) => {
      console.error("[ProfilePage] Error counting expenses:", err)
      return 0
    }),
    prisma.settlement.count({ 
      where: { 
        OR: [
          { payerId: session.user.id }, 
          { receiverId: session.user.id }
        ] 
      } 
    }).catch((err) => {
      console.error("[ProfilePage] Error counting settlements:", err)
      return 0
    }),
    getUserSettings().catch((err) => {
      console.error("[ProfilePage] Error fetching settings:", err)
      return { ...defaultUserSettings, userId: session.user!.id }
    }),
  ])

  const { totalOwedToUser = 0, totalUserOwes = 0 } = balancesData || {}

  return (
    <div className="flex flex-col flex-1 bg-[#09090b] text-zinc-100 min-h-[100dvh] pb-28">
      {/* 1. Profile Header */}
      <header className="bg-[#121316] px-6 pt-10 pb-6 flex flex-col items-center border-b border-zinc-800/80 shadow-sm">
        <ProfileImageUpload 
          currentImage={user?.image?.startsWith('data:') ? `/api/users/${user.id}/avatar` : (user?.image || session.user.image || null)} 
          name={user?.name || session.user.name || 'User'} 
        />
        <h1 className="text-2xl font-bold text-zinc-100 mb-0.5 mt-3 tracking-tight">
          {user?.name || session.user.name}
        </h1>
        <p className="text-sm text-zinc-400 mb-3 font-medium">
          {user?.email || session.user.email}
        </p>
        
        <div className="flex items-center gap-2.5 text-xs text-zinc-300 font-medium bg-[#15171b] border border-zinc-800 px-4 py-1.5 rounded-full mb-4">
          <span>{user?.phone}</span>
          <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
          <span className="font-mono text-zinc-300">{user?.upiId || 'No UPI ID'}</span>
        </div>

        <Link 
          href="/profile/edit" 
          className="px-5 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 active:scale-95 text-zinc-100 border border-zinc-700/60 rounded-full text-xs font-bold transition-all shadow-sm"
        >
          Edit Profile
        </Link>
      </header>

      {/* 2. Main Content */}
      <div className="flex-1 w-full max-w-md mx-auto">
        {/* Compact Financial Summary */}
        <div className="px-4 mt-6 mb-2">
          <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-3 px-1">
            Financial Summary
          </h2>
          
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-red-950/20 rounded-2xl p-4 border border-red-900/30 flex flex-col">
              <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider mb-1">
                You Owe
              </span>
              <span className="text-xl font-bold text-red-400">
                ₹{totalUserOwes.toFixed(2)}
              </span>
            </div>
            <div className="bg-emerald-950/20 rounded-2xl p-4 border border-emerald-900/30 flex flex-col">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                You&apos;re Owed
              </span>
              <span className="text-xl font-bold text-emerald-400">
                ₹{totalOwedToUser.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#121316] rounded-2xl p-3 border border-zinc-800/80 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-zinc-100">{groupCount}</span>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase mt-0.5">Groups</span>
            </div>
            <div className="bg-[#121316] rounded-2xl p-3 border border-zinc-800/80 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-zinc-100">{expenseCount}</span>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase mt-0.5">Expenses</span>
            </div>
            <div className="bg-[#121316] rounded-2xl p-3 border border-zinc-800/80 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-zinc-100">{settlementCount}</span>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase mt-0.5">Settlements</span>
            </div>
          </div>
        </div>

        {/* 3. Settings Sections */}
        <SettingsList 
          userName={user?.name || session.user.name || ""} 
          userPhone={user?.phone || ""} 
          upiId={user?.upiId || ""} 
          email={user?.email || session.user.email || ""}
          isAdmin={user?.role === 'ADMIN'}
        />

        <div className="px-4 mt-4">
          <ProfileSections initialSettings={userSettings} />
        </div>

        {/* Logout */}
        <div className="px-4 mt-6 mb-4">
          <form action={async () => {
            "use server"
            await signOut({ redirectTo: '/login' })
          }}>
            <button 
              type="submit" 
              className="w-full py-4 flex items-center justify-center gap-2 text-red-400 hover:text-red-300 font-bold bg-[#121316] hover:bg-red-950/20 active:bg-red-950/30 rounded-2xl border border-red-900/30 transition-colors cursor-pointer"
            >
              <LogOut size={18} />
              <span>Log Out</span>
            </button>
          </form>
        </div>
      </div>

      <BottomNav
        activeTab="profile"
        userImage={user?.image || session.user.image}
        userName={user?.name || session.user.name}
      />
    </div>
  )
}
