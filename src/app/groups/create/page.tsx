import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { CreateGroupForm } from "@/components/groups/CreateGroupForm"

export default async function CreateGroupPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="flex flex-col flex-1 bg-white dark:bg-zinc-950">
      <header className="flex items-center p-4 border-b border-gray-100 dark:border-zinc-800">
        <Link href="/" className="p-2 -ml-2 text-gray-900 dark:text-zinc-100 active:bg-gray-100 dark:active:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold ml-2 text-gray-900 dark:text-zinc-100">Create Group</h1>
      </header>

      <div className="p-6">
        <CreateGroupForm />
      </div>
    </div>
  )
}
