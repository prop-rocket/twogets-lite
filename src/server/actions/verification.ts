"use server";

import { revalidatePath } from "next/cache";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { verificationSubmitSchema } from "@/lib/validations";
import { IDENTITY_DOCUMENTS, OWNERSHIP_DOCUMENTS } from "@/lib/constants";
import type { ActionResult } from "@/types";

/**
 * Records a verification request after the client uploads the document to the
 * private `verification-documents` bucket (path: {userId}/{docType}-{ts}.{ext}).
 */
export async function submitVerification(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  const parsed = verificationSubmitSchema.safeParse({
    documentType: formData.get("documentType"),
    storagePath: formData.get("storagePath"),
    propertyId: formData.get("propertyId") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Invalid document submission" };
  const d = parsed.data;

  if (!d.storagePath.startsWith(`${user.id}/`)) {
    return { ok: false, error: "Invalid upload path" };
  }
  if (OWNERSHIP_DOCUMENTS.includes(d.documentType) && !d.propertyId) {
    return { ok: false, error: "Ownership documents must be linked to a property" };
  }
  if (IDENTITY_DOCUMENTS.includes(d.documentType) && d.propertyId) {
    return { ok: false, error: "Identity documents are not linked to a property" };
  }

  const supabase = await createClient();

  // Replace a previously rejected request for the same document, if any.
  await supabase
    .from("verification_requests")
    .delete()
    .eq("user_id", user.id)
    .eq("document_type", d.documentType)
    .eq("status", "rejected");

  const { error } = await supabase.from("verification_requests").insert({
    user_id: user.id,
    property_id: d.propertyId ?? null,
    document_type: d.documentType,
    storage_path: d.storagePath,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "This document is already submitted or approved" };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/verification");
  return { ok: true, message: "Document submitted for review" };
}
