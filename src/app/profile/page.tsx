import { auth, signOut } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { 
  LogOut
} from "lucide-react"
import { getUserBalances } from "@/services/balance"
import ProfileImageUpload from "./upload-form"
import SettingsList from "./SettingsList"
import { getUserSettings } from "@/actions/settings"
import BottomNav from "@/components/navigation/BottomNav"
import ProfileSections from "./ProfileSections"

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) redirect('/login?expired=1')

  const [
    { totalOwedToUser, totalUserOwes },
    groupCount,
    expenseCount,
    settlementCount,
    userSettings,
  ] = await Promise.all([
    getUserBalances(session.user.id),
    prisma.groupMember.count({ where: { userId: session.user.id } }),
    prisma.expense.count({ 
      where: { 
        OR: [
          { payerId: session.user.id }, 
          { participants: { some: { userId: session.user.id } } }
        ] 
      } 
    }),
    prisma.settlement.count({ 
      where: { 
        OR: [
          { payerId: session.user.id }, 
          { receiverId: session.user.id }
        ] 
      } 
    }),
    getUserSettings(),
  ])

  return (
    <div className="flex flex-col flex-1 bg-gray-50 dark:bg-black min-h-screen pb-24">
      {/* 1. Profile Header */}
      <header className="bg-white dark:bg-zinc-950 px-6 pt-10 pb-6 flex flex-col items-center border-b border-gray-100 dark:border-zinc-900 shadow-sm">
        <ProfileImageUpload 
          currentImage={user?.image?.startsWith('data:') ? `/api/users/${user.id}/avatar` : (user?.image || session.user.image || null)} 
          name={user?.name || session.user.name || 'User'} 
        />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-0.5 mt-3">{user?.name || session.user.name}</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-2">{user?.email || session.user.email}</p>
        
        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-zinc-400 font-medium bg-gray-50 dark:bg-zinc-900 px-4 py-1.5 rounded-full mb-4">
          <span>{user?.phone}</span>
          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-zinc-700"></span>
          <span className="font-mono">{user?.upiId || 'No UPI ID'}</span>
        </div>

        <Link href="/setup-profile" className="px-5 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-bold active:scale-95 transition-transform">
          Edit Profile
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* 2. Compact Financial Summary */}
        <div className="px-4 mt-6 mb-2">
          <h2 className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 px-2">Financial Summary</h2>
          
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col">
              <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">You Owe</span>
              <span className="text-lg font-bold text-red-600 dark:text-red-500">₹{totalUserOwes.toFixed(2)}</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col">
              <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">You&apos;re Owed</span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-500">₹{totalOwedToUser.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-gray-900 dark:text-zinc-100">{groupCount}</span>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-zinc-400 uppercase mt-0.5">Groups</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-gray-900 dark:text-zinc-100">{expenseCount}</span>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-zinc-400 uppercase mt-0.5">Expenses</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-gray-900 dark:text-zinc-100">{settlementCount}</span>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-zinc-400 uppercase mt-0.5">Settlements</span>
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

        <ProfileSections initialSettings={userSettings} />

        {/* Logout */}
        <div className="px-4 mt-6 mb-4">
          <form action={async () => {
            "use server"
            await signOut({ redirectTo: '/login' })
          }}>
            <button type="submit" className="w-full py-4 flex items-center justify-center gap-2 text-red-600 dark:text-red-500 font-bold bg-white dark:bg-zinc-900 rounded-2xl border border-red-100 dark:border-red-900/30 active:bg-red-50 dark:active:bg-red-950/20 shadow-sm transition-colors">
              <LogOut size={18} />
              Log Out
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
