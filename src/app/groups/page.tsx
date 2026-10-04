import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import BottomNav from "@/components/navigation/BottomNav"
import GroupsListClient from "./GroupsListClient"
import { getGroupBalances } from "@/services/balance"

export default async function GroupsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      groupMembers: {
        include: {
          group: {
            include: {
              _count: {
                select: { members: true }
              },
              expenses: {
                select: {
                  amount: true
                }
              }
            }
          }
        }
      }
    }
  })

  // Calculate balances for each group using domain logic
  const groupsData = await Promise.all(
    (user?.groupMembers || []).map(async ({ group }) => {
      const { netPositions } = await getGroupBalances(group.id)
      
      // Calculate net balance for current user in this group
      let netAmount = 0
      const userId = session!.user!.id!
      const userPositions = netPositions[userId] || {}
      for (const amount of Object.values(userPositions)) {
        netAmount += amount as number
      }

      const totalSpent = group.expenses.reduce((sum, exp) => sum + exp.amount, 0)

      return {
        id: group.id,
        name: group.name,
        image: group.image,
        type: group.type,
        destination: group.destination,
        startDate: group.startDate?.toISOString(),
        endDate: group.endDate?.toISOString(),
        targetAmount: group.targetAmount,
        deadline: group.deadline?.toISOString(),
        poolOwnerId: group.poolOwnerId,
        memberCount: group._count.members,
        netAmount,
        totalSpent
      }
    })
  )

  return (
    <div className="flex flex-col flex-1 bg-[#09090b] text-zinc-100 min-h-[100dvh] pb-24">
      <div className="flex-1 w-full max-w-md mx-auto">
        <GroupsListClient groups={groupsData as any} />
      </div>

      <BottomNav
        activeTab="groups"
        userImage={session.user.image}
        userName={session.user.name}
      />
    </div>
  )
}
