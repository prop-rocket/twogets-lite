import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { getCurrentUser } from "@/lib/supabase/server";
import type { UserRow } from "@/types";

export const MODE_COOKIE = "tg_mode";
export type AppMode = "travelling" | "hosting";

/**
 * Which side of the marketplace the UI is currently showing.
 *
 * This is presentation only — never a security boundary. Every listing action
 * re-checks can_host() in the database, so a forged cookie buys nothing.
 */
export const getActiveMode = cache(async (): Promise<AppMode> => {
  const user = await getCurrentUser();
  if (!user) return "travelling";

  const raw = (await cookies()).get(MODE_COOKIE)?.value;
  // A stale "hosting" cookie must not strand someone whose hosting was revoked.
  if (raw === "hosting") return user.can_host ? "hosting" : "travelling";
  if (raw === "travelling") return "travelling";

  // No preference recorded yet: land hosts on their hosting side.
  return user.can_host ? "hosting" : "travelling";
});

/** Everyone except admins can rent. */
export function canTravel(user: UserRow | null): boolean {
  return Boolean(user && user.role !== "admin" && !user.is_banned);
}

/** Listing requires the opt-in capability. */
export function canHost(user: UserRow | null): boolean {
  return Boolean(user?.can_host && !user.is_banned);
}
