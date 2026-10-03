import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, UserPlus, CreditCard, Receipt, Plus, ShieldCheck } from "lucide-react"
import { getFriendProfile } from "@/actions/friend"
import { formatPaise } from "@/domain/money"
import RemoveFriendButton from "./RemoveFriendButton"

export default async function FriendProfilePage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const sessionUserId = session.user.id

  const { id } = await params

  let profile: any = null
  try {
    profile = await getFriendProfile(id)
  } catch {
    redirect("/friends")
  }

  const { friend, balance, sharedExpenses, sharedSettlements } = profile
  const isOwed = balance.type === "OWED_TO_USER"
  const isOwes = balance.type === "USER_OWES"
  const isSettled = balance.amount === 0 || balance.type === "SETTLED"

  return (
    <div className="flex flex-col flex-1 bg-gray-50 dark:bg-zinc-950 min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/friends"
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-base font-bold text-gray-900 dark:text-zinc-100 truncate">
            {friend.name}
          </h1>
        </div>

        <RemoveFriendButton friendId={friend.id} />
      </header>

      {/* Main Profile Content */}
      <main className="max-w-md w-full mx-auto px-4 py-5 space-y-4">
        {/* Profile Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 font-bold text-xl flex items-center justify-center mb-3 overflow-hidden border-2 border-gray-100 dark:border-zinc-800">
            {friend.image ? (
              <img
                src={friend.image.startsWith("data:") ? `/api/users/${friend.id}/avatar` : friend.image}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              friend.name?.charAt(0) || "U"
            )}
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100">{friend.name}</h2>
          {friend.upiId && (
            <p className="text-xs text-gray-500 dark:text-zinc-400 font-mono mt-0.5">
              UPI: {friend.upiId}
            </p>
          )}

          {/* Balance Banner */}
          <div
            className={`w-full mt-5 p-4 rounded-2xl border ${
              isSettled
                ? "bg-gray-50 dark:bg-zinc-800/50 border-gray-100 dark:border-zinc-800"
                : isOwed
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40"
                : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40"
            }`}
          >
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block ${
                isSettled
                  ? "text-gray-400 dark:text-zinc-500"
                  : isOwed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {isSettled ? "Balance" : isOwed ? "They owe you" : "You owe them"}
            </span>
            <p
              className={`text-2xl font-black font-mono mt-0.5 ${
                isSettled
                  ? "text-gray-700 dark:text-zinc-300"
                  : isOwed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatPaise(balance.amount)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full mt-4">
            <Link
              href="/expenses/add"
              className="flex-1 bg-black dark:bg-white text-white dark:text-black py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs"
            >
              <Plus size={16} />
              <span>Add Expense</span>
            </Link>

            {isOwes && (
              <Link
                href={`/settle?userId=${friend.id}`}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs"
              >
                <CreditCard size={16} />
                <span>Settle Up</span>
              </Link>
            )}
          </div>
        </div>

        {/* Shared History Accordion / List */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
            Shared Transactions ({sharedExpenses.length + sharedSettlements.length})
          </h3>

          {sharedExpenses.length === 0 && sharedSettlements.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500 dark:text-zinc-400">
              No shared expenses recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {sharedExpenses.map((exp: any) => (
                <div
                  key={exp.id}
                  className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Receipt size={16} className="text-blue-500 shrink-0" />
                    <div>
                      <p className="font-bold text-gray-900 dark:text-zinc-100">{exp.description}</p>
                      <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                        {new Date(exp.createdAt).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-zinc-100 font-mono">
                    {formatPaise(exp.amount)}
                  </span>
                </div>
              ))}

              {sharedSettlements.map((st: any) => (
                <div
                  key={st.id}
                  className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <CreditCard size={16} className="text-emerald-500 shrink-0" />
                    <div>
                      <p className="font-bold text-gray-900 dark:text-zinc-100">
                        {st.payerId === sessionUserId ? "You paid" : `${friend.name} paid`}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                        {new Date(st.createdAt).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatPaise(st.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
