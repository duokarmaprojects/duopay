import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react"
import { getUserBalances } from "@/services/balance"
import { generateUpiIntent } from "@/domain/upi"
import { recordSettlement } from "@/actions/settlement"

export default async function SettlePage({
  searchParams,
}: {
  searchParams: { userId?: string, groupId?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { userId, groupId } = await searchParams
  if (!userId) redirect('/')

  // Fetch target user to pay
  const receiver = await prisma.user.findUnique({
    where: { id: userId }
  })
  if (!receiver || !receiver.upiId) {
    return <div className="p-6">User not found or missing UPI ID.</div>
  }

  // Calculate exactly how much is owed
  const balances = await getUserBalances(session.user.id).catch(() => ({
    totalOwedToUser: 0,
    totalUserOwes: 0,
    detailedBalances: [],
  }))
  
  // Find the exact balance for this receiver
  const detailedBalances = Array.isArray(balances?.detailedBalances) ? balances.detailedBalances : []
  const balance = detailedBalances.find(b => b?.userId === userId)
  const amountToPay = balance?.type === 'USER_OWES' ? balance.amount : 0

  if (amountToPay === 0) {
    return (
      <div className="flex flex-col flex-1 p-6 items-center justify-center bg-white h-screen">
        <h1 className="text-4xl font-bold mb-4">₹0</h1>
        <h2 className="text-xl font-medium text-gray-500 mb-8 uppercase tracking-widest">ALL SETTLED 🎉</h2>
        <Link href={groupId ? `/groups/${groupId}` : "/"} className="bg-gray-100 text-gray-900 px-6 py-3 rounded-full font-medium">
          Go Back
        </Link>
      </div>
    )
  }

  const upiIntent = generateUpiIntent(receiver.upiId, receiver.name || 'Friend', amountToPay)

  return (
    <div className="flex flex-col flex-1 bg-white h-screen">
      <header className="flex items-center p-4 border-b border-gray-100">
        <Link href={groupId ? `/groups/${groupId}` : "/"} className="p-2 -ml-2 text-gray-900 active:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold ml-2">Settle Up</h1>
      </header>

      <div className="flex-1 p-6 flex flex-col items-center pt-12">
        {/* Avatar & Receiver Info */}
        <div className="w-20 h-20 bg-gray-100 rounded-full mb-4 overflow-hidden flex items-center justify-center text-gray-500 text-2xl font-bold">
          {receiver.image ? (
            <img 
              src={receiver.image.startsWith('data:') ? `/api/users/${receiver.id}/avatar` : receiver.image} 
              className="w-full h-full object-cover" 
              alt=""
            />
          ) : (
            receiver.name?.charAt(0)
          )}
        </div>
        <p className="text-gray-500 font-medium mb-1">Paying {receiver.name}</p>
        <h2 className="text-4xl font-bold mb-6">₹{amountToPay / 100}</h2>

        {/* UPI ID Details Card */}
        <div className="w-full max-w-sm mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">UPI ID</span>
          <p className="font-mono font-medium text-base text-gray-900">{receiver.upiId}</p>
        </div>

        <a 
          href={upiIntent}
          className="w-full max-w-sm text-white font-bold py-4 px-4 rounded-xl text-center transition-colors shadow-lg mb-6 bg-black hover:bg-gray-800 shadow-gray-900/20 active:bg-gray-900"
        >
          Pay with UPI App
        </a>

        <div className="w-full max-w-sm border-t border-gray-100 pt-6">
          <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100 flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 font-medium">
                Automatic payment verification is not available for direct peer-to-peer UPI transfers.
              </p>
            </div>
            <p className="text-xs text-amber-700/80 pl-6">
              Please manually confirm once you have completed the payment in your UPI app.
            </p>
          </div>

          <form action={recordSettlement} className="flex gap-3">
            <input type="hidden" name="receiverId" value={userId} />
            <input type="hidden" name="amountPaise" value={amountToPay} />
            {groupId && <input type="hidden" name="groupId" value={groupId} />}
            <button
              type="submit"
              className="flex-1 bg-black text-white font-semibold py-3 px-4 rounded-xl active:bg-gray-800 text-sm"
            >
              Manually Confirm Payment
            </button>
            <Link 
              href={groupId ? `/groups/${groupId}` : "/"}
              className="flex-1 bg-gray-100 text-gray-900 font-semibold py-3 px-4 rounded-xl text-center active:bg-gray-200 text-sm"
            >
              Not Yet
            </Link>
          </form>
        </div>
      </div>
    </div>
  )
}
