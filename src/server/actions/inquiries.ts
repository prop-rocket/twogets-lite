"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { appointmentUpdateSchema, inquirySchema } from "@/lib/validations";
import type { ActionResult } from "@/types";

export async function requestViewing(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const propertyId = String(formData.get("propertyId") ?? "");
  if (!user) redirect(`/login?next=/properties/${propertyId}`);
  if (user.role !== "tenant") return { ok: false, error: "Only tenants can request viewings" };

  const parsed = inquirySchema.safeParse({
    propertyId,
    message: formData.get("message") ?? "",
    preferredDate: formData.get("preferredDate"),
    preferredTime: formData.get("preferredTime"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id, owner_id, status")
    .eq("id", parsed.data.propertyId)
    .single();
  if (!property || property.status !== "active") {
    return { ok: false, error: "This listing is no longer available" };
  }
  if (property.owner_id === user.id) {
    return { ok: false, error: "You can't request a viewing on your own listing" };
  }

  const { error } = await supabase.from("inquiries").insert({
    property_id: property.id,
    tenant_id: user.id,
    owner_id: property.owner_id,
    message: parsed.data.message,
    preferred_date: parsed.data.preferredDate,
    preferred_time: parsed.data.preferredTime,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "You already have a pending request for this property" };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/inquiries");
  return { ok: true, message: "Viewing request sent to the owner" };
}

export async function respondToInquiry(
  inquiryId: string,
  decision: "accepted" | "rejected",
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "homeowner") return { ok: false, error: "Sign in as a homeowner" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("inquiries")
    .update({ status: decision })
    .eq("id", inquiryId)
    .eq("owner_id", user.id)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/inquiries");
  revalidatePath("/dashboard/appointments");
  return {
    ok: true,
    message: decision === "accepted" ? "Viewing accepted — appointment scheduled" : "Request declined",
  };
}

export async function cancelInquiry(inquiryId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("inquiries")
    .update({ status: "cancelled" })
    .eq("id", inquiryId)
    .eq("tenant_id", user.id)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/inquiries");
  return { ok: true, message: "Request cancelled" };
}

export async function updateAppointment(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  const parsed = appointmentUpdateSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    status: formData.get("status"),
    scheduledDate: formData.get("scheduledDate") || undefined,
    scheduledTime: formData.get("scheduledTime") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Invalid appointment update" };

  const supabase = await createClient();
  const updates: { status: typeof parsed.data.status; scheduled_date?: string; scheduled_time?: string } = {
    status: parsed.data.status,
  };
  if (parsed.data.scheduledDate) updates.scheduled_date = parsed.data.scheduledDate;
  if (parsed.data.scheduledTime) updates.scheduled_time = parsed.data.scheduledTime;

  const { error } = await supabase
    .from("appointments")
    .update(updates)
    .eq("id", parsed.data.appointmentId)
    .or(`tenant_id.eq.${user.id},owner_id.eq.${user.id}`);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/appointments");
  return { ok: true, message: "Appointment updated" };
}
