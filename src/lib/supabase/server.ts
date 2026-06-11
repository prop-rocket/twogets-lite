import { cookies } from "next/headers";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import type { Database, UserRow } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component — middleware refreshes sessions instead.
          }
        },
      },
    },
  );
}

/**
 * Authenticated user + their public.users row, deduped per request.
 * Returns null when signed out.
 */
export const getCurrentUser = cache(async (): Promise<UserRow | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("users").select("*").eq("id", user.id).single();
  return data ?? null;
});
