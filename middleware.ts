import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// NOTE:
// Keep middleware minimal and runtime-safe.
// Auth/role gating is handled server-side in layouts/pages via `auth()`.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*"]
};
