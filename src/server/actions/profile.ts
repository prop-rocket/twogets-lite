"use server";

import { revalidatePath } from "next/cache";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { homeownerProfileSchema, tenantProfileSchema } from "@/lib/validations";
import type { ActionResult, TenantProfileRow } from "@/types";

export async function updateTenantProfile(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "tenant") return { ok: false, error: "Sign in as a tenant" };

  const parsed = tenantProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") ?? "",
    occupation: formData.get("occupation") ?? "",
    employer: formData.get("employer") ?? "",
    incomeRange: formData.get("incomeRange") || undefined,
    occupancyType: formData.get("occupancyType") ?? "any",
    hasPets: formData.get("hasPets") === "on" || formData.get("hasPets") === "true",
    foodPreference: formData.get("foodPreference") ?? "no_preference",
    preferredLocations: String(formData.get("preferredLocations") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    budgetMin: formData.get("budgetMin") || undefined,
    budgetMax: formData.get("budgetMax") || undefined,
    moveInDate: formData.get("moveInDate") ?? "",
    linkedinUrl: formData.get("linkedinUrl") ?? "",
    about: formData.get("about") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  if (d.budgetMin != null && d.budgetMax != null && d.budgetMax < d.budgetMin) {
    return { ok: false, error: "Max budget must be at least the min budget" };
  }

  const supabase = await createClient();

  const { error: userError } = await supabase
    .from("users")
    .update({ full_name: d.fullName, phone: d.phone || null })
    .eq("id", user.id);
  if (userError) return { ok: false, error: userError.message };

  const { error } = await supabase.from("tenant_profiles").upsert({
    user_id: user.id,
    occupation: d.occupation || null,
    employer: d.employer || null,
    income_range: d.incomeRange ?? null,
    occupancy_type: d.occupancyType,
    has_pets: d.hasPets,
    food_preference: d.foodPreference,
    preferred_locations: d.preferredLocations,
    budget_min: d.budgetMin ?? null,
    budget_max: d.budgetMax ?? null,
    move_in_date: d.moveInDate || null,
    linkedin_url: d.linkedinUrl || null,
    about: d.about || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Profile saved" };
}

export async function updateHomeownerProfile(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "homeowner") return { ok: false, error: "Sign in as a homeowner" };

  const parsed = homeownerProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") ?? "",
    about: formData.get("about") ?? "",
    city: formData.get("city") ?? "",
    linkedinUrl: formData.get("linkedinUrl") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { error: userError } = await supabase
    .from("users")
    .update({ full_name: d.fullName, phone: d.phone || null })
    .eq("id", user.id);
  if (userError) return { ok: false, error: userError.message };

  const { error } = await supabase.from("homeowner_profiles").upsert({
    user_id: user.id,
    about: d.about || null,
    city: d.city || null,
    linkedin_url: d.linkedinUrl || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Profile saved" };
}

/** Percentage of tenant profile fields filled — drives the dashboard meter. */
export async function tenantProfileCompletion(
  profile: TenantProfileRow | null,
  phone: string | null,
): Promise<number> {
  if (!profile) return 10;
  const checks = [
    Boolean(phone),
    Boolean(profile.occupation),
    Boolean(profile.employer),
    Boolean(profile.income_range),
    profile.preferred_locations.length > 0,
    profile.budget_min != null || profile.budget_max != null,
    Boolean(profile.move_in_date),
    Boolean(profile.linkedin_url),
    Boolean(profile.about),
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round(10 + (filled / checks.length) * 90);
}
