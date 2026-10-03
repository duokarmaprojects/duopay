import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { Users, Receipt, ArrowRightLeft, ShieldAlert, Award, Gift, Bell } from "lucide-react"

export const metadata = {
  title: "Admin Dashboard | DuoPay",
}

export default async function AdminDashboard() {
  await requireAdmin()

  // Parallel KPI queries
  const [
    totalUsers,
    activeUsers,
    totalExpenses,
    totalSettlements,
    verifiedSettlements,
    cashbackIssued,
    referralSignups,
    securityEvents,
    pushSubscribers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.expense.count(),
    prisma.settlement.count(),
    prisma.settlement.count({
      where: {
        paymentStatus: { in: ["PROVIDER_VERIFIED", "WEBHOOK_VERIFIED"] },
      },
    }),
    prisma.cashbackLedger.aggregate({
      where: { status: "EARNED" },
      _sum: { amountPaise: true },
    }),
    prisma.referral.count({
      where: { signupRewardStatus: "EARNED" },
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: {
          in: [
            "MALICIOUS_INPUT_BLOCKED",
            "IDOR_ATTEMPT_BLOCKED",
            "AUTH_UNAUTHORIZED_ACCESS",
            "RATE_LIMIT_TRIGGERED",
          ],
        },
      },
    }),
    prisma.pushSubscription.count({
      where: { isActive: true },
    }),
  ])

  const cashbackTotalRupees = ((cashbackIssued._sum.amountPaise || 0) / 100).toFixed(2)

  const stats = [
    { name: "Total Users", value: totalUsers, icon: Users, sub: "Registered accounts" },
    { name: "Active Users (30d)", value: activeUsers, icon: Users, sub: "Monthly active" },
    { name: "Total Expenses", value: totalExpenses, icon: Receipt, sub: "Expenses created" },
    { name: "Settlements", value: totalSettlements, icon: ArrowRightLeft, sub: `${verifiedSettlements} verified` },
    { name: "Cashback Awarded", value: `₹${cashbackTotalRupees}`, icon: Award, sub: "Qualifying rewards" },
    { name: "Referrals Active", value: referralSignups, icon: Gift, sub: "Earned milestones" },
    { name: "Active Push Subs", value: pushSubscribers, icon: Bell, sub: "Deliverable devices" },
    { name: "Security Alerts", value: securityEvents, icon: ShieldAlert, sub: "Blocks & rate limits" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
          Operations & Financial Overview
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Server-authoritative aggregate metrics, verified settlement volume, rewards & security health.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.name}
            className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2.5 text-blue-600 dark:text-blue-400">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="truncate text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {item.name}
              </p>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-gray-900 dark:text-zinc-100 font-mono">
                {item.value}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
