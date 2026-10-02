import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Users } from "lucide-react"
import { GroupIcon } from "@/components/ui/GroupIcon"

export default async function JoinGroupPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/groups/join/${params.id}`)
  }

  const { id } = await params

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: true }
      }
    }
  })

  if (!group) {
    return (
      <div className="flex flex-col flex-1 bg-gray-50 h-screen items-center justify-center p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Group not found</h1>
        <p className="text-gray-500 mb-6">This group may have been deleted or the link is invalid.</p>
        <Link href="/" className="bg-black text-white px-6 py-3 rounded-xl font-semibold">Go Home</Link>
      </div>
    )
  }

  const isAlreadyMember = group.members.some(m => m.userId === session.user?.id)

  if (isAlreadyMember) {
    redirect(`/groups/${id}`)
  }

  async function handleJoin() {
    "use server"
    const session = await auth()
    if (!session?.user?.id) redirect('/login')

    await prisma.groupMember.create({
      data: {
        groupId: id,
        userId: session.user.id
      }
    })

    redirect(`/groups/${id}`)
  }

  return (
    <div className="flex flex-col flex-1 bg-gray-50 h-screen items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 max-w-sm w-full text-center flex flex-col items-center">
        <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-900 mb-6 shadow-inner">
          <GroupIcon iconId={group.image} size={32} />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{group.name}</h1>
        <p className="text-gray-500 text-sm mb-8">
          You've been invited to join this group to split expenses. Currently has {group.members.length} member{group.members.length !== 1 && 's'}.
        </p>

        <form action={handleJoin} className="w-full">
          <button type="submit" className="w-full bg-black text-white font-semibold py-4 rounded-xl active:bg-gray-800 transition-colors shadow-md">
            Join Group
          </button>
        </form>
        
        <Link href="/" className="mt-4 text-sm font-medium text-gray-400 hover:text-gray-600">
          Decline Invite
        </Link>
      </div>
    </div>
  )
}
