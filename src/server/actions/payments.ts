"use server";

import { revalidatePath } from "next/cache";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { manualPaymentSchema } from "@/lib/validations";
import type { ActionResult } from "@/types";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

/**
 * Record a payment taken outside the platform (bank transfer, UPI, cash) and
 * optionally put the person on a plan. There is no gateway yet — when Razorpay
 * lands it writes the same tables with its own provider ids, and users.plan
 * keeps following subscriptions through the sync trigger either way.
 */
export async function recordManualPayment(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };

  const parsed = manualPaymentSchema.safeParse({
    userId: formData.get("userId"),
    planCode: formData.get("planCode"),
    amountRupees: formData.get("amountRupees"),
    method: formData.get("method") || undefined,
    notes: formData.get("notes") || undefined,
    months: formData.get("months") || 1,
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the form", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const supabase = await createClient();
  let subscriptionId: string | null = null;

  if (d.planCode !== "free") {
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + d.months);

    // One live subscription per user is enforced by a partial unique index, so
    // close any existing one before opening the new period.
    await supabase
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", d.userId)
      .in("status", ["trialing", "active", "past_due"]);

    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: d.userId,
        plan_code: d.planCode,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        created_by: admin.id,
        notes: d.notes ?? null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    subscriptionId = data.id;
  }

  const { error: txnError } = await supabase.from("transactions").insert({
    user_id: d.userId,
    subscription_id: subscriptionId,
    amount_paise: Math.round(d.amountRupees * 100),
    status: "captured",
    method: d.method ?? null,
    recorded_by: admin.id,
    notes: d.notes ?? null,
    captured_at: new Date().toISOString(),
  });
  if (txnError) return { ok: false, error: txnError.message };

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/users/${d.userId}`);
  return { ok: true, message: "Payment recorded" };
}

/** End a subscription now. The sync trigger drops users.plan back to free. */
export async function cancelSubscription(subscriptionId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("id", subscriptionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/payments");
  return { ok: true, message: "Subscription cancelled" };
}
