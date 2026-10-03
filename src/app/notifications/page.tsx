import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getUserNotifications } from "@/actions/notification"
import NotificationCenterClient from "./NotificationCenterClient"
import BottomNav from "@/components/navigation/BottomNav"

export const metadata = {
  title: "Notifications | DuoPay",
  description: "Stay up to date on your expenses, settlements, and rewards.",
}

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const { notifications, unreadCount } = await getUserNotifications(50)

  return (
    <div className="flex flex-col flex-1 bg-gray-50 dark:bg-zinc-950 min-h-screen pb-24 text-gray-900 dark:text-zinc-100">
      <NotificationCenterClient
        initialNotifications={notifications}
        initialUnreadCount={unreadCount}
      />

      <BottomNav
        activeTab="profile"
        userImage={session.user.image}
        userName={session.user.name}
      />
    </div>
  )
}
