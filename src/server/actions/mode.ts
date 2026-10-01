"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { MODE_COOKIE, type AppMode } from "@/lib/mode";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const ONE_YEAR = 60 * 60 * 24 * 365;

async function writeMode(mode: AppMode) {
  (await cookies()).set(MODE_COOKIE, mode, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
    secure: process.env.NODE_ENV === "production",
  });
}

/** Flip which side of the marketplace the UI shows. Presentation only. */
export async function setMode(mode: AppMode): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };
  if (mode === "hosting" && !user.can_host) {
    return { ok: false, error: "Set up hosting first" };
  }

  await writeMode(mode);
  revalidatePath("/", "layout");
  return { ok: true, message: mode === "hosting" ? "Switched to hosting" : "Switched to renting" };
}

/**
 * Turn on the lister side for this account and drop them straight into it.
 * Capability and cookie move together so the switch never half-applies.
 */
export async function becomeHost(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };
  if (user.role === "admin") return { ok: false, error: "Admin accounts can't host" };
  if (user.is_banned) return { ok: false, error: "Account suspended" };

  if (!user.can_host) {
    const supabase = await createClient();
    const { error } = await supabase.from("users").update({ can_host: true }).eq("id", user.id);
    if (error) return { ok: false, error: error.message };
  }

  await writeMode("hosting");
  revalidatePath("/", "layout");
  return { ok: true, message: "Hosting is set up — add your first listing" };
}
