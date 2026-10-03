import { auth, signOut } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { 
  User, Users, Activity, 
  LogOut, 
  PieChart, Receipt, CheckCircle2 
} from "lucide-react"
import { getUserBalances } from "@/services/balance"
import ProfileImageUpload from "./upload-form"
import AppearanceSettings from "./AppearanceSettings"
import UpiModal, { UpiDetailsCard } from "./UpiModal"
import ProfileSections from "./ProfileSections"
import { getUserSettings } from "@/actions/settings"
import { getCashbackSummary } from "@/actions/cashback"
import CashbackCard from "@/components/rewards/CashbackCard"

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [
    user,
    { totalOwedToUser, totalUserOwes },
    groupCount,
    expenseCount,
    settlementCount,
    userSettings,
    cashbackSummary,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
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
    getCashbackSummary(),
  ])

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-6 mt-8">{children}</h2>
  )

  return (
    <div className="flex flex-col flex-1 bg-gray-50 pb-24">
      {/* 1. Profile Header */}
      <header className="bg-white px-6 pt-10 pb-8 flex flex-col items-center">
        <ProfileImageUpload 
          currentImage={user?.image?.startsWith('data:') ? `/api/users/${user.id}/avatar` : (user?.image || session.user.image || null)} 
          name={user?.name || session.user.name || 'User'} 
        />
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{user?.name || session.user.name}</h1>
        <div className="flex flex-col items-center gap-2 mt-1">
          <div className="flex items-center gap-3 text-sm text-gray-500 font-medium">
            <span>{user?.phone}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
            <span className="text-gray-900 font-medium font-mono">{user?.upiId || 'No UPI ID'}</span>
          </div>
          <UpiModal currentUpiId={user?.upiId || null} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* 2. DuoPay Cashback & Rewards */}
        <div className="px-6 mt-6">
          <CashbackCard summary={cashbackSummary} />
        </div>

        {/* 3. DuoPay Overview */}
        <SectionTitle>Your DuoPay</SectionTitle>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mx-6 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-50">
            <div className="flex items-center gap-3 text-gray-700">
              <Users size={18} />
              <span className="font-medium text-sm">Groups</span>
            </div>
            <span className="font-bold text-gray-900">{groupCount}</span>
          </div>
          <div className="flex items-center justify-between p-4 border-b border-gray-50">
            <div className="flex items-center gap-3 text-gray-700">
              <Receipt size={18} />
              <span className="font-medium text-sm">Expenses</span>
            </div>
            <span className="font-bold text-gray-900">{expenseCount}</span>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3 text-gray-700">
              <CheckCircle2 size={18} />
              <span className="font-medium text-sm">Settlements</span>
            </div>
            <span className="font-bold text-gray-900">{settlementCount}</span>
          </div>
        </div>

        {/* 4. Quick Actions */}
        <SectionTitle>Quick Actions</SectionTitle>
        <div className="px-6 flex gap-3">
          <UpiDetailsCard currentUpiId={user?.upiId || null} />
          <Link href="/groups" className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col gap-3 active:scale-95 transition-transform">
            <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
              <PieChart size={18} />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900">Manage Groups</p>
              <p className="text-[10px] text-gray-500 mt-0.5">View all groups</p>
            </div>
          </Link>
        </div>

        {/* 5. Account Section */}
        <SectionTitle>Account</SectionTitle>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mx-6 flex flex-col overflow-hidden">
          {user?.role === 'ADMIN' && (
            <Link href="/admin" className="flex items-center gap-4 p-4 border-b border-gray-50 active:bg-gray-50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
              </div>
              <div className="flex flex-col flex-1">
                <span className="font-semibold text-gray-900 text-sm">Admin Panel</span>
                <span className="text-xs text-gray-500">Internal metrics and tools</span>
              </div>
            </Link>
          )}
          <AppearanceSettings />
          <ProfileSections initialSettings={userSettings} />
        </div>

        {/* 6. Logout */}
        <div className="px-6 mt-8 mb-4">
          <form action={async () => {
            "use server"
            await signOut({ redirectTo: '/login' })
          }}>
            <button type="submit" className="w-full py-4 flex items-center justify-center gap-2 text-red-600 font-bold bg-white rounded-2xl border border-red-100 active:bg-red-50 shadow-sm transition-colors">
              <LogOut size={18} />
              Log Out
            </button>
          </form>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 flex justify-between px-6 pb-[env(safe-area-inset-bottom)] pt-2 z-20">
        <Link href="/" className="flex flex-col items-center p-2 text-gray-400 hover:text-black transition-colors">
          <div className="p-1"><User size={24} /></div>
          <span className="text-[10px] font-medium mt-1">Home</span>
        </Link>
        <Link href="/groups" className="flex flex-col items-center p-2 text-gray-400 hover:text-black transition-colors">
          <div className="p-1"><Users size={24} /></div>
          <span className="text-[10px] font-medium mt-1">Groups</span>
        </Link>
        <Link href="/activity" className="flex flex-col items-center p-2 text-gray-400 hover:text-black transition-colors">
          <div className="p-1"><Activity size={24} /></div>
          <span className="text-[10px] font-medium mt-1">Activity</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center p-2 text-black">
          <div className="p-1">
            <div className="w-6 h-6 rounded-full border-2 border-current overflow-hidden flex items-center justify-center bg-gray-100">
              {user?.image || session.user.image ? <img src={user?.image || session.user.image || undefined} className="w-full h-full object-cover" alt=""/> : <span className="text-[10px] font-bold text-gray-500">{user?.name?.charAt(0) || session.user.name?.charAt(0) || 'U'}</span>}
            </div>
          </div>
          <span className="text-[10px] font-medium mt-1">Profile</span>
        </Link>
      </nav>
    </div>
  )
}
