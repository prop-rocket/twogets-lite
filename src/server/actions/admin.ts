"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { verificationReviewSchema } from "@/lib/validations";
import type { ActionResult, PropertyStatus, ReportStatus, UserPlan } from "@/types";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Append to the admin audit trail.
 *
 * audit_logs is deliberately admin-read-only; writes go through the
 * log_admin_action() security-definer function, which stamps actor_id from
 * auth.uid() so a caller cannot forge who did what. Direct inserts here would
 * be rejected by RLS — which is exactly the bug this replaces.
 */
async function logAdmin(
  supabase: SupabaseServerClient,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase.rpc("log_admin_action", {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_metadata: metadata,
  });
  // Never fail the admin action because the trail write failed, but do surface it.
  if (error) console.error(`audit log failed (${action} ${entityType}:${entityId}):`, error.message);
}

export async function reviewVerification(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };

  const parsed = verificationReviewSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    rejectionReason: formData.get("rejectionReason") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Invalid review" };
  if (parsed.data.decision === "rejected" && !parsed.data.rejectionReason) {
    return { ok: false, error: "Give a reason when rejecting" };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("verification_requests")
    .update({
      status: parsed.data.decision,
      rejection_reason: parsed.data.rejectionReason ?? null,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.requestId)
    .eq("status", "pending")
    .select("id, user_id, property_id, document_type")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "That request was already reviewed" };

  await logAdmin(supabase, `verification.${parsed.data.decision}`, "verification_request", updated.id, {
    user_id: updated.user_id,
    property_id: updated.property_id,
    document_type: updated.document_type,
    rejection_reason: parsed.data.rejectionReason ?? null,
  });

  // Approval flips users.is_verified / properties.is_verified via trigger, and
  // those badges render on public pages.
  revalidatePath("/admin/verifications");
  if (updated.property_id) revalidatePath(`/properties/${updated.property_id}`);
  revalidatePath("/properties");
  return { ok: true, message: `Document ${parsed.data.decision}` };
}

/**
 * Signed URL so admins can inspect a private verification document.
 *
 * Takes the request id rather than a storage path: the path is read from the
 * row here, so a caller can never have an arbitrary path in the private bucket
 * signed for them.
 */
export async function getDocumentSignedUrl(requestId: string): Promise<ActionResult<{ url: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };

  const supabase = await createClient();
  const { data: request, error: lookupError } = await supabase
    .from("verification_requests")
    .select("id, storage_path")
    .eq("id", requestId)
    .maybeSingle();
  if (lookupError || !request) return { ok: false, error: "Verification request not found" };

  const { data, error } = await createAdminClient()
    .storage.from("verification-documents")
    .createSignedUrl(request.storage_path, 60 * 10);
  if (error || !data) return { ok: false, error: "Could not generate document link" };

  await logAdmin(supabase, "verification.document.viewed", "verification_request", request.id);
  return { ok: true, data: { url: data.signedUrl } };
}

export async function setUserBanned(userId: string, banned: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };
  if (userId === admin.id) return { ok: false, error: "You can't ban yourself" };

  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ is_banned: banned }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await logAdmin(supabase, banned ? "user.banned" : "user.unbanned", "user", userId);

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true, message: banned ? "User banned" : "User unbanned" };
}

export async function setUserPlan(userId: string, plan: UserPlan): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };

  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ plan }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await logAdmin(supabase, `user.plan.${plan}`, "user", userId, { plan });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true, message: plan === "plus" ? "Upgraded to Plus" : "Moved to Free plan" };
}

export async function adminSetListingStatus(
  propertyId: string,
  status: PropertyStatus,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };

  const supabase = await createClient();
  const { error } = await supabase.from("properties").update({ status }).eq("id", propertyId);
  if (error) return { ok: false, error: error.message };

  await logAdmin(supabase, `listing.status.${status}`, "property", propertyId, { status });

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${propertyId}`);
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true, message: `Listing set to ${status}` };
}

/**
 * Records that an admin has spoken to the real owner. Required alongside
 * documents before a listing someone else owns can show a verified badge.
 */
export async function confirmListingWithOwner(
  propertyId: string,
  confirmed: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_listing_with_owner", {
    p_property_id: propertyId,
    p_confirmed: confirmed,
  });
  if (error) return { ok: false, error: error.message };

  await logAdmin(supabase, confirmed ? "listing.owner_confirmed" : "listing.owner_unconfirmed", "property", propertyId);

  revalidatePath(`/admin/listings/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true, message: confirmed ? "Owner confirmed" : "Owner confirmation removed" };
}

export async function moderateReview(reviewId: string, approve: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("reviews")
    .update({ is_approved: approve })
    .eq("id", reviewId)
    .select("id, property_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "Review not found" };

  await logAdmin(supabase, approve ? "review.approved" : "review.hidden", "review", reviewId);

  revalidatePath("/admin/reviews");
  // Hiding a review changes what the public property page shows.
  if (updated.property_id) revalidatePath(`/properties/${updated.property_id}`);
  return { ok: true, message: approve ? "Review visible" : "Review hidden" };
}

export async function resolveReport(reportId: string, status: ReportStatus): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("reports")
    .update({ status, resolved_by: admin.id, resolved_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("status", "open") // don't let an already-closed report be re-resolved
    .select("id, target_type, target_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "That report was already closed" };

  await logAdmin(supabase, `report.${status}`, "report", updated.id, {
    target_type: updated.target_type,
    target_id: updated.target_id,
  });

  revalidatePath("/admin/reports");
  return { ok: true, message: `Report ${status}` };
}
