import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { completeProfile } from "@/actions/user"

export default async function SetupProfilePage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (user?.phone && user?.upiId && user?.name && user.name !== 'New User') {
    redirect('/')
  }

  return (
    <div className="flex flex-col flex-1 p-6 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pt-12 min-h-screen">
      <h1 className="text-2xl font-bold mb-2 tracking-tight">Welcome to DuoPay</h1>
      <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-sm">
        Let&apos;s set up your profile so friends can easily split expenses with you.
      </p>

      <form action={completeProfile} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            Full Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={user?.name && user.name !== "New User" ? user.name : ""}
            placeholder="Full name"
            required
            className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-base font-medium [color-scheme:dark]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            Phone Number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={user?.phone || ""}
            readOnly={!!user?.phone}
            placeholder="Phone number"
            required
            className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white read-only:opacity-60 read-only:cursor-not-allowed transition-all text-base font-medium [color-scheme:dark]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="upiId" className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            UPI ID
          </label>
          <input
            id="upiId"
            name="upiId"
            type="text"
            defaultValue={user?.upiId && user.upiId !== "username@bank" ? user.upiId : ""}
            placeholder=""
            required
            className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-base font-medium font-mono [color-scheme:dark]"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Format: username@handle. Used for receiving settlements.
          </p>
        </div>

        <button
          type="submit"
          className="mt-4 w-full bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-semibold py-3.5 px-4 rounded-xl active:scale-[0.99] transition-all shadow-sm"
        >
          Complete Setup
        </button>
      </form>
    </div>
  )
}
