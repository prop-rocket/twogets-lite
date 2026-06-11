"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loginSchema, roleSelectionSchema, signupSchema } from "@/lib/validations";
import { siteUrl } from "@/lib/utils";
import type { ActionResult } from "@/types";

export async function signup(formData: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, role: parsed.data.role },
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function login(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: "Invalid email or password" };

  revalidatePath("/", "layout");
  const next = formData.get("next");
  redirect(typeof next === "string" && next.startsWith("/") ? next : "/dashboard");
}

export async function signInWithGoogle(next?: string) {
  const supabase = await createClient();
  const redirectTo = new URL("/auth/callback", siteUrl());
  if (next && next.startsWith("/")) redirectTo.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo.toString() },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/** OAuth users land without a role; they pick one on /onboarding/role. */
export async function selectRole(formData: FormData): Promise<void> {
  const parsed = roleSelectionSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) redirect("/onboarding/role?error=invalid");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (existing?.role) redirect("/dashboard"); // role is immutable once chosen

  const { error } = await supabase.from("users").update({ role: parsed.data.role }).eq("id", user.id);
  if (error) redirect("/onboarding/role?error=failed");

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
