import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Users, Plus } from "lucide-react"
import { GroupIcon } from "@/components/ui/GroupIcon"

export default async function GroupsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      groupMembers: {
        include: { group: true }
      }
    }
  })

  return (
    <div className="flex flex-col flex-1 bg-gray-50 pb-20">
      <header className="bg-white px-6 pt-8 pb-4 border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-2xl font-bold">Groups</h1>
        <Link href="/groups/create" className="p-2 bg-gray-100 text-gray-900 rounded-full active:bg-gray-200">
          <Plus size={24} />
        </Link>
      </header>

      <div className="p-6">
        {user?.groupMembers.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm mt-10">
            <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users size={24} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No groups yet</h3>
            <p className="text-sm text-gray-500 mb-4">Create your first group to start splitting expenses.</p>
            <Link href="/groups/create" className="inline-block bg-black text-white text-sm font-medium px-4 py-2 rounded-lg">
              Create Group
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {user?.groupMembers.map(({ group }) => (
              <Link key={group.id} href={`/groups/${group.id}`} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-900">
                  <GroupIcon iconId={group.image} size={28} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">{group.name}</h3>
                  <p className="text-sm text-gray-500">View group</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 flex justify-between px-6 pb-[env(safe-area-inset-bottom)] pt-2 z-20">
        <Link href="/" className="flex flex-col items-center p-2 text-gray-400 hover:text-black transition-colors">
          <div className="p-1"><Users size={24} className="opacity-0" style={{display: 'none'}}/><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          <span className="text-[10px] font-medium mt-1">Home</span>
        </Link>
        <Link href="/groups" className="flex flex-col items-center p-2 text-black">
          <div className="p-1"><Users size={24} strokeWidth={2.5} /></div>
          <span className="text-[10px] font-medium mt-1">Groups</span>
        </Link>
        <Link href="/activity" className="flex flex-col items-center p-2 text-gray-400 hover:text-black transition-colors">
          <div className="p-1"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
          <span className="text-[10px] font-medium mt-1">Activity</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center p-2 text-gray-400 hover:text-black transition-colors">
          <div className="p-1">
            <div className="w-6 h-6 rounded-full border-2 border-current overflow-hidden flex items-center justify-center bg-gray-100">
              {session.user.image ? <img src={session.user.image} className="w-full h-full object-cover" alt=""/> : <span className="text-[10px] font-bold text-gray-500">{session.user.name?.charAt(0) || 'U'}</span>}
            </div>
          </div>
          <span className="text-[10px] font-medium mt-1">Profile</span>
        </Link>
      </nav>
    </div>
  )
}
