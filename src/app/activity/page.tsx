import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import ActivityFeed, { ActivityItem } from "./ActivityFeed"
import BottomNav from "@/components/navigation/BottomNav"

export default async function ActivityPage({
  searchParams,
}: {
  searchParams?: { page?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id
  const userName = session.user.name || "Unknown"
  const userImage = session.user.image

  // Fetch authorized expenses
  const expenses = await prisma.expense.findMany({
    where: {
      OR: [
        { payerId: userId },
        { participants: { some: { userId: userId } } },
      ],
    },
    include: {
      payer: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  })

  // Fetch authorized settlements
  const settlements = await prisma.settlement.findMany({
    where: {
      OR: [
        { payerId: userId },
        { receiverId: userId },
      ],
    },
    include: {
      payer: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  })

  // Fetch user friendships (recent friend events)
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userId }, { friendId: userId }],
      status: "ACCEPTED",
    },
    include: {
      user: { select: { id: true, name: true } },
      friend: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 15,
  })

  // Fetch groups joined by user
  const groupMemberships = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: { select: { id: true, name: true } },
    },
    orderBy: { joinedAt: "desc" },
    take: 10,
  })

  // Transform and combine
  const activities: ActivityItem[] = [
    ...expenses.map((e) => ({
      id: `exp_${e.id}`,
      type: "EXPENSE" as const,
      amount: e.amount,
      description: e.description,
      category: e.category,
      groupId: e.group?.id,
      groupName: e.group?.name,
      date: e.createdAt.toISOString(),
      isUserPayer: e.payerId === userId,
      payerName: e.payer.name || "Unknown",
    })),
    ...settlements.map((s) => ({
      id: `set_${s.id}`,
      type: "SETTLEMENT" as const,
      amount: s.amount,
      description: s.paymentStatus === "PROVIDER_VERIFIED" || s.paymentStatus === "WEBHOOK_VERIFIED"
        ? "Verified Payment"
        : "Settlement",
      status: s.status,
      paymentStatus: s.paymentStatus,
      groupId: s.group?.id,
      groupName: s.group?.name,
      date: s.createdAt.toISOString(),
      isUserPayer: s.payerId === userId,
      payerName: s.payer.name || "Unknown",
      receiverName: s.receiver.name || "Unknown",
    })),
    ...friendships.map((f) => {
      const otherUser = f.userId === userId ? f.friend : f.user
      return {
        id: `frd_${f.id}`,
        type: "FRIEND_ADDED" as const,
        amount: 0,
        description: `Connected with ${otherUser.name || "a friend"}`,
        date: f.updatedAt.toISOString(),
        isUserPayer: false,
        payerName: otherUser.name || "Friend",
      }
    }),
    ...groupMemberships.map((gm) => ({
      id: `grp_${gm.id}`,
      type: "GROUP_JOINED" as const,
      amount: 0,
      description: `Joined group "${gm.group.name}"`,
      groupId: gm.group.id,
      groupName: gm.group.name,
      date: gm.joinedAt.toISOString(),
      isUserPayer: true,
      payerName: "You",
    })),
  ]

  // Sort combined timeline by date descending
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="flex flex-col flex-1 bg-gray-50 pb-20 min-h-screen">
      <header className="bg-white/80 backdrop-blur-md px-6 pt-10 pb-4 border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
          <p className="text-xs text-gray-500 mt-0.5">Real-time timeline of expenses, settlements & events</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <ActivityFeed activities={activities} />
      </div>

      <BottomNav activeTab="activity" userImage={userImage} userName={userName} />
    </div>
  )
}
