import { NextResponse } from "next/server";

// NOTE:
// Keep middleware minimal and runtime-safe.
// Auth/role gating is handled server-side in layouts/pages via `auth()`.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*"]
};
