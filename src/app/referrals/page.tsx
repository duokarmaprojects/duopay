import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getReferralSummary } from "@/actions/referral"
import ReferralView from "@/components/referrals/ReferralView"

export const metadata = {
  title: "Refer & Earn ₹21* | DuoPay",
  description: "Invite your friends to DuoPay and earn up to ₹21* per verified referral.",
}

export default async function ReferralsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/referrals")
  }

  const summary = await getReferralSummary()

  return <ReferralView summary={summary} />
}
