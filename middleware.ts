import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets, so sessions stay fresh
     * and protected routes are enforced at the edge.
     */
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
