import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getSpendingAnalytics, TimeRangeFilter } from "@/actions/analytics"
import AnalyticsDashboard from "./AnalyticsDashboard"
import BottomNav from "@/components/navigation/BottomNav"

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: { range?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const range = (searchParams?.range || "MONTH") as TimeRangeFilter
  const analytics = await getSpendingAnalytics(range)

  return (
    <div className="flex flex-col flex-1 bg-gray-50 pb-20 min-h-screen">
      <header className="bg-white/80 backdrop-blur-md px-6 pt-10 pb-4 border-b border-gray-100 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-gray-900">Spending Insights</h1>
        <p className="text-xs text-gray-500 mt-0.5">Authoritative breakdown of your shared spending</p>
      </header>

      <div className="flex-1 overflow-y-auto">
        <AnalyticsDashboard initialData={analytics} currentRange={range} />
      </div>

      <BottomNav
        activeTab="activity"
        userImage={session.user.image}
        userName={session.user.name}
      />
    </div>
  )
}
