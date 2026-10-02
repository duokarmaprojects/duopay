import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db"
import { authConfig } from "./auth.config"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Phone Number",
      credentials: {
        phone: { label: "Phone Number", type: "text", placeholder: "e.g. 9876543210" },
        name: { label: "Full Name", type: "text", placeholder: "e.g. Rahul" }
      },
      async authorize(credentials) {
        if (!credentials?.phone || typeof credentials.phone !== "string") return null
        
        // Find or create user
        let user = await prisma.user.findFirst({
          where: { phone: credentials.phone }
        })

        if (!user) {
          user = await prisma.user.create({
            data: {
              phone: credentials.phone,
              name: typeof credentials.name === "string" ? credentials.name : "New User"
            }
          })
        }

        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          upiId: user.upiId,
          role: user.role,
          image: user.image ? `/api/users/${user.id}/avatar` : null
        }
      }
    })
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role || 'USER'
        token.phone = (user as any).phone
        token.upiId = (user as any).upiId
        token.picture = user.image ? `/api/users/${user.id}/avatar` : null
      } else if (token.id) {
        // Refresh token data from DB periodically if needed
        const dbUser = await prisma.user.findUnique({ 
          where: { id: token.id as string },
          select: { phone: true, upiId: true, image: true, role: true }
        })
        if (dbUser) {
          token.phone = dbUser.phone
          token.upiId = dbUser.upiId
          token.role = dbUser.role
          token.picture = dbUser.image ? `/api/users/${token.id}/avatar` : null
        }
      }
      // CRITICAL: NEVER store raw data: URLs in token (prevents Vercel 494 REQUEST_HEADER_TOO_LARGE)
      if (typeof token.picture === "string" && token.picture.startsWith("data:")) {
        token.picture = token.id ? `/api/users/${token.id}/avatar` : null
      }
      delete (token as any).image
      delete (token as any).dataUrl
      return token
    },
  }
})
