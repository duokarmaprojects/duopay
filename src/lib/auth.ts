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
          image: user.image
        }
      }
    })
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.phone = (user as any).phone
        token.upiId = (user as any).upiId
      } else if (token.id) {
        // Refresh token data from DB periodically if needed, but for MVP it's fine.
        const dbUser = await prisma.user.findUnique({ where: { id: token.id as string } })
        if (dbUser) {
          token.phone = dbUser.phone
          token.upiId = dbUser.upiId
        }
      }
      return token
    },
  }
})
