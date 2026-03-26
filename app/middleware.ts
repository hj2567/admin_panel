import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const isOnVercel = process.env.VERCEL === "1" || !!process.env.VERCEL_URL;

  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    const token = req.cookies.get("id_token")?.value;
    if (!token) return NextResponse.redirect(new URL("/auth", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};