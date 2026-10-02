import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { createGroup } from "@/actions/group"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { GroupIconPicker } from "@/components/ui/GroupIconPicker"

export default async function CreateGroupPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="flex flex-col flex-1 bg-white">
      <header className="flex items-center p-4 border-b border-gray-100">
        <Link href="/" className="p-2 -ml-2 text-gray-900 active:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold ml-2">Create Group</h1>
      </header>

      <div className="p-6">
        <form action={createGroup} className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <label htmlFor="name" className="text-sm font-semibold text-gray-900">
              Group Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="e.g. Goa Trip"
              required
              maxLength={50}
              className="w-full border border-gray-300 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-lg bg-transparent"
            />
          </div>

          <div className="flex flex-col gap-3 items-center mt-2">
            <div className="flex flex-col gap-1 items-center text-center">
              <label className="text-sm font-semibold text-gray-900 dark:text-white">
                Group Icon
              </label>
              <span className="text-xs text-gray-500">Optional &middot; Choose an icon</span>
            </div>
            <GroupIconPicker name="image" defaultValue="" />
          </div>

          <button
            type="submit"
            className="mt-8 w-full bg-black text-white font-bold py-4 px-4 rounded-xl active:bg-gray-800 transition-colors shadow-lg"
          >
            Save Group
          </button>
        </form>
      </div>
    </div>
  )
}
