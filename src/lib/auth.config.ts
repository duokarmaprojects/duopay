import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  providers: [],
  pages: {
    signIn: '/login',
    newUser: '/setup-profile',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.phone = (user as any).phone
        token.upiId = (user as any).upiId
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        ;(session.user as any).phone = token.phone
        ;(session.user as any).upiId = token.upiId
      }
      return session
    },
  },
} satisfies NextAuthConfig
