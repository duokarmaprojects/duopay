import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import AddMemberForm from "./AddMemberForm"
import { generateGroupInviteToken } from "@/lib/invite"

export default async function AddMemberPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params
  const inviteToken = generateGroupInviteToken(id, session.user.id)

  return (
    <div className="flex flex-col flex-1 bg-white h-screen">
      <header className="flex items-center p-4 border-b border-gray-100">
        <Link href={`/groups/${id}`} className="p-2 -ml-2 text-gray-900 active:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold ml-2">Add Friend to Group</h1>
      </header>

      <div className="p-6">
        <AddMemberForm groupId={id} inviteToken={inviteToken} />
      </div>
    </div>
  )
}

