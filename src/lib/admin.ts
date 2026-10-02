import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"

export async function requireAdmin() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/admin')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })

  if (!user || user.role !== 'ADMIN') {
    redirect('/unauthorized')
  }

  return session.user
}

export async function isAdmin() {
  const session = await auth()
  if (!session?.user?.id) return false
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })
  
  return user?.role === 'ADMIN'
}
