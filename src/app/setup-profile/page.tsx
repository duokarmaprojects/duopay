import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { completeProfile } from "@/actions/user"

export default async function SetupProfilePage() {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }

  const user = session.user as any
  if (user?.phone && user?.upiId) {
    redirect('/')
  }

  return (
    <div className="flex flex-col flex-1 p-6 bg-white pt-12">
      <h1 className="text-2xl font-bold mb-2">Welcome to DuoPay</h1>
      <p className="text-gray-500 mb-8">
        Let's set up your profile so friends can easily split expenses with you.
      </p>

      <form action={completeProfile} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="phone" className="text-sm font-medium text-gray-700">
            Phone Number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={user?.phone || ""}
            readOnly={!!user?.phone}
            placeholder="e.g. +91 9876543210"
            required
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent read-only:bg-gray-100 read-only:text-gray-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="upiId" className="text-sm font-medium text-gray-700">
            UPI ID
          </label>
          <input
            id="upiId"
            name="upiId"
            type="text"
            placeholder="e.g. name@bank"
            required
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Format: username@handle (e.g. name@okhdfcbank). Newly added UPI IDs require verification before being marked as verified payment destinations.
          </p>
        </div>

        <button
          type="submit"
          className="mt-4 w-full bg-black text-white font-semibold py-3.5 px-4 rounded-xl active:bg-gray-800 transition-colors"
        >
          Complete Setup
        </button>
      </form>
    </div>
  )
}
