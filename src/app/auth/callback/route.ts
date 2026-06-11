import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * OAuth & email-confirmation callback. Exchanges the auth code for a session,
 * then routes new OAuth users (no role yet) to role selection.
 */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single();
      const destination = profile?.role ? safeNext : "/onboarding/role";
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
