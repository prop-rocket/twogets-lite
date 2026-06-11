"use server";

import { revalidatePath } from "next/cache";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { reportSchema, reviewSchema } from "@/lib/validations";
import type { ActionResult } from "@/types";

export async function submitReview(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  const parsed = reviewSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    reviewType: formData.get("reviewType"),
    ratingCommunication: formData.get("ratingCommunication"),
    ratingDepositFairness: formData.get("ratingDepositFairness") || undefined,
    ratingPropertyAccuracy: formData.get("ratingPropertyAccuracy") || undefined,
    ratingReliability: formData.get("ratingReliability") || undefined,
    ratingPropertyCare: formData.get("ratingPropertyCare") || undefined,
    comment: formData.get("comment") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Fill in every rating", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, property_id, tenant_id, owner_id, status")
    .eq("id", d.appointmentId)
    .single();
  if (!appointment) return { ok: false, error: "Appointment not found" };
  if (appointment.status !== "completed") {
    return { ok: false, error: "You can review after the viewing is completed" };
  }

  const isTenant = appointment.tenant_id === user.id;
  const isOwner = appointment.owner_id === user.id;
  if (!isTenant && !isOwner) return { ok: false, error: "You were not part of this viewing" };

  // Tenants review the owner (owner_review); owners review the tenant.
  const expectedType = isTenant ? "owner_review" : "tenant_review";
  if (d.reviewType !== expectedType) return { ok: false, error: "Invalid review type" };

  const dims =
    expectedType === "owner_review"
      ? [d.ratingCommunication, d.ratingDepositFairness, d.ratingPropertyAccuracy]
      : [d.ratingCommunication, d.ratingReliability, d.ratingPropertyCare];
  if (dims.some((v) => v == null)) return { ok: false, error: "Fill in every rating" };
  const overall = Number(
    ((dims as number[]).reduce((a, b) => a + b, 0) / dims.length).toFixed(2),
  );

  const { error } = await supabase.from("reviews").insert({
    review_type: expectedType,
    appointment_id: appointment.id,
    property_id: expectedType === "owner_review" ? appointment.property_id : null,
    reviewer_id: user.id,
    reviewee_id: isTenant ? appointment.owner_id : appointment.tenant_id,
    rating_communication: d.ratingCommunication,
    rating_deposit_fairness: expectedType === "owner_review" ? d.ratingDepositFairness : null,
    rating_property_accuracy: expectedType === "owner_review" ? d.ratingPropertyAccuracy : null,
    rating_reliability: expectedType === "tenant_review" ? d.ratingReliability : null,
    rating_property_care: expectedType === "tenant_review" ? d.ratingPropertyCare : null,
    overall_rating: overall,
    comment: d.comment,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You already reviewed this viewing" };
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/reviews");
  if (appointment.property_id) revalidatePath(`/properties/${appointment.property_id}`);
  return { ok: true, message: "Review published" };
}

export async function submitReport(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to report" };

  const parsed = reportSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    reason: formData.get("reason"),
    details: formData.get("details") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, message: "Report submitted — our team will take a look" };
}
