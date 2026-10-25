import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { safeCallbackUrl } from "@/lib/callback-url"

export default auth((request) => {
  const { pathname, search } = request.nextUrl
  if (pathname.startsWith("/api/")) return NextResponse.next()

  const isLoggedIn = Boolean(request.auth)
  const isLogin = pathname === "/login"

  if (!isLoggedIn && !isLogin) {
    const url = new URL("/login", request.nextUrl.origin)
    if (pathname !== "/") url.searchParams.set("callbackUrl", `${pathname}${search}`)
    return NextResponse.redirect(url)
  }

  if (isLoggedIn && (isLogin || pathname === "/")) {
    const destination = isLogin ? safeCallbackUrl(request.nextUrl.searchParams.get("callbackUrl")) : "/dashboard"
    return NextResponse.redirect(new URL(destination, request.nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}
