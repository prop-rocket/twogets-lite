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
  const { error } = await supabase
    .from("verification_requests")
    .update({
      status: parsed.data.decision,
      rejection_reason: parsed.data.rejectionReason ?? null,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.requestId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/verifications");
  return { ok: true, message: `Document ${parsed.data.decision}` };
}

/** Signed URL so admins can inspect a private verification document. */
export async function getDocumentSignedUrl(storagePath: string): Promise<ActionResult<{ url: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("verification-documents")
    .createSignedUrl(storagePath, 60 * 10);
  if (error || !data) return { ok: false, error: "Could not generate document link" };

  return { ok: true, data: { url: data.signedUrl } };
}

export async function setUserBanned(userId: string, banned: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };
  if (userId === admin.id) return { ok: false, error: "You can't ban yourself" };

  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ is_banned: banned }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_logs").insert({
    actor_id: admin.id,
    action: banned ? "user.banned" : "user.unbanned",
    entity_type: "user",
    entity_id: userId,
  });

  revalidatePath("/admin/users");
  return { ok: true, message: banned ? "User banned" : "User unbanned" };
}

export async function setUserPlan(userId: string, plan: UserPlan): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };

  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ plan }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_logs").insert({
    actor_id: admin.id,
    action: `user.plan.${plan}`,
    entity_type: "user",
    entity_id: userId,
  });

  revalidatePath("/admin/users");
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

  revalidatePath("/admin/listings");
  revalidatePath("/properties");
  return { ok: true, message: `Listing set to ${status}` };
}

export async function moderateReview(reviewId: string, approve: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };

  const supabase = await createClient();
  const { error } = await supabase.from("reviews").update({ is_approved: approve }).eq("id", reviewId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_logs").insert({
    actor_id: admin.id,
    action: approve ? "review.approved" : "review.hidden",
    entity_type: "review",
    entity_id: reviewId,
  });

  revalidatePath("/admin/reviews");
  return { ok: true, message: approve ? "Review visible" : "Review hidden" };
}

export async function resolveReport(reportId: string, status: ReportStatus): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admin access required" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ status, resolved_by: admin.id, resolved_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/reports");
  return { ok: true, message: `Report ${status}` };
}
