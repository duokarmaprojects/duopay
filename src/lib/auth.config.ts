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
        token.role = (user as any).role || 'USER'
        token.phone = (user as any).phone
        token.upiId = (user as any).upiId
      }
      // CRITICAL: NEVER store base64 images in JWT cookies (prevents Vercel 494 REQUEST_HEADER_TOO_LARGE)
      if (typeof token.picture === "string" && token.picture.startsWith("data:")) {
        token.picture = token.id ? `/api/users/${token.id}/avatar` : null
      }
      delete (token as any).image
      delete (token as any).dataUrl

      // Development safety check: prevent token payload bloat
      if (process.env.NODE_ENV !== "production") {
        const payloadSize = JSON.stringify(token).length
        if (payloadSize > 1000) {
          console.error(
            `[AUTH WARNING] JWT payload size is ${payloadSize} bytes! Must remain under 1000 bytes.`
          )
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        ;(session.user as any).phone = token.phone
        ;(session.user as any).upiId = token.upiId
        session.user.image = (token.picture as string) || null
      }
      return session
    },
  },
} satisfies NextAuthConfig
