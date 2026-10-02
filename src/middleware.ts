import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  const isAuthRoute = nextUrl.pathname.startsWith('/api/auth')
  const isLoginRoute = nextUrl.pathname === '/login'

  let response: NextResponse

  if (isAuthRoute) {
    response = NextResponse.next()
  } else if (isLoginRoute) {
    if (isLoggedIn) {
      response = NextResponse.redirect(new URL('/', nextUrl))
    } else {
      response = NextResponse.next()
    }
  } else if (!isLoggedIn) {
    response = NextResponse.redirect(new URL('/login', nextUrl))
  } else {
    response = NextResponse.next()
  }

  // Clear stale cookie chunks if present to keep headers small (< 1KB)
  for (let i = 1; i <= 20; i++) {
    const name = `authjs.session-token.${i}`
    const secureName = `__Secure-authjs.session-token.${i}`
    if (req.cookies.has(name)) {
      response.cookies.delete(name)
    }
    if (req.cookies.has(secureName)) {
      response.cookies.delete(secureName)
    }
  }

  return response
})

// Optionally, don't invoke Middleware on some paths
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
}
