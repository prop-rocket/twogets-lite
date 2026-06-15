"use server";

import { revalidatePath } from "next/cache";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { oneOffSlotSchema, recurringRuleSchema } from "@/lib/validations";
import { getOpenSlots } from "@/server/queries";
import type { ActionResult, TenantSlot, ViewingBookingStatus } from "@/types";

/** Open future slots for a listing (used by the swipe schedule sheet). */
export async function listOpenSlots(propertyId: string): Promise<TenantSlot[]> {
  const user = await getCurrentUser();
  return getOpenSlots(propertyId, user?.id);
}

const IST_OFFSET = "+05:30"; // TwoGets' market; owners enter wall-clock IST times.

/** Build a UTC instant from an IST wall-clock date + time. */
function istInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${IST_OFFSET}`);
}

/** Split an availability window into back-to-back sub-slots (or one open house). */
function windowsFor(
  start: Date,
  end: Date,
  durationMin: number | undefined,
): { starts_at: string; ends_at: string }[] {
  if (!durationMin) return [{ starts_at: start.toISOString(), ends_at: end.toISOString() }];
  const out: { starts_at: string; ends_at: string }[] = [];
  let cur = start.getTime();
  const endMs = end.getTime();
  const step = durationMin * 60_000;
  while (cur < endMs) {
    const nxt = Math.min(cur + step, endMs);
    out.push({ starts_at: new Date(cur).toISOString(), ends_at: new Date(nxt).toISOString() });
    cur = nxt;
  }
  return out;
}

async function assertOwnsProperty(propertyId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "homeowner") {
    return { error: "Sign in as a homeowner" as const, user: null };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data) return { error: "That listing isn't yours" as const, user: null };
  return { error: null, user };
}

function revalidateViewings(propertyId?: string) {
  revalidatePath("/dashboard/viewings");
  if (propertyId) {
    revalidatePath(`/dashboard/listings/${propertyId}/viewings`);
    revalidatePath(`/properties/${propertyId}`);
  }
}

// ---------------------------------------------------------------------------
// Owner: publish availability
// ---------------------------------------------------------------------------
export async function addOneOffSlots(formData: FormData): Promise<ActionResult> {
  const parsed = oneOffSlotSchema.safeParse({
    propertyId: formData.get("propertyId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    slotDurationMin: formData.get("slotDurationMin") || undefined,
    capacity: formData.get("capacity") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the slot details", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const { error: ownErr, user } = await assertOwnsProperty(d.propertyId);
  if (ownErr || !user) return { ok: false, error: ownErr ?? "Not allowed" };

  const start = istInstant(d.date, d.startTime);
  const end = istInstant(d.date, d.endTime);
  if (end <= start) return { ok: false, error: "End time must be after start time" };
  if (end <= new Date()) return { ok: false, error: "Pick a time in the future" };

  const rows = windowsFor(start, end, d.slotDurationMin).map((w) => ({
    listing_id: d.propertyId,
    owner_id: user.id,
    source: "manual" as const,
    capacity: d.capacity ?? null,
    ...w,
  }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("viewing_slots")
    .upsert(rows, { onConflict: "listing_id,starts_at,ends_at", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };

  revalidateViewings(d.propertyId);
  return { ok: true, message: rows.length > 1 ? `Published ${rows.length} slots` : "Slot published" };
}

export async function addRecurringRule(formData: FormData): Promise<ActionResult> {
  const parsed = recurringRuleSchema.safeParse({
    propertyId: formData.get("propertyId"),
    daysOfWeek: formData.getAll("daysOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    slotDurationMin: formData.get("slotDurationMin") || undefined,
    capacity: formData.get("capacity") || undefined,
    validUntil: formData.get("validUntil") || "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the recurring availability", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const { error: ownErr, user } = await assertOwnsProperty(d.propertyId);
  if (ownErr || !user) return { ok: false, error: ownErr ?? "Not allowed" };

  const supabase = await createClient();
  const days = [...new Set(d.daysOfWeek)];
  let generated = 0;

  for (const day of days) {
    const { data: rule, error: ruleErr } = await supabase
      .from("viewing_availability_rules")
      .insert({
        listing_id: d.propertyId,
        owner_id: user.id,
        day_of_week: day,
        start_time: d.startTime,
        end_time: d.endTime,
        slot_duration_min: d.slotDurationMin ?? null,
        capacity: d.capacity ?? null,
        valid_until: d.validUntil ? d.validUntil : null,
      })
      .select("id")
      .single();
    if (ruleErr) return { ok: false, error: ruleErr.message };

    const { data: count, error: genErr } = await supabase.rpc("generate_slots_for_rule", {
      p_rule_id: rule.id,
    });
    if (genErr) return { ok: false, error: genErr.message };
    generated += count ?? 0;
  }

  revalidateViewings(d.propertyId);
  return {
    ok: true,
    message: `Recurring availability saved — ${generated} slot${generated === 1 ? "" : "s"} published over the next 4 weeks`,
  };
}

export async function cancelSlot(slotId: string, propertyId?: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_viewing_slot", { p_slot_id: slotId });
  if (error) return { ok: false, error: error.message.replace(/^.*:\s*/, "") };

  revalidateViewings(propertyId);
  return { ok: true, message: "Slot cancelled — attendees were released" };
}

export async function setAttendance(
  bookingId: string,
  status: ViewingBookingStatus,
  propertyId?: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_booking_attendance", {
    p_booking_id: bookingId,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message.replace(/^.*:\s*/, "") };

  revalidateViewings(propertyId);
  return { ok: true, message: "Attendance updated" };
}

// ---------------------------------------------------------------------------
// Tenant: book / cancel
// ---------------------------------------------------------------------------
const BOOK_ERROR_CODES: [RegExp, string][] = [
  [/signed in/i, "auth"],
  [/only tenants/i, "role"],
  [/suspended/i, "banned"],
  [/full/i, "full"],
  [/past/i, "past"],
  [/not open|not found/i, "unavailable"],
];

export async function bookSlot(
  slotId: string,
  partySize = 1,
  note?: string,
): Promise<ActionResult<{ bookingId: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to book", code: "auth" };
  if (user.role !== "tenant") return { ok: false, error: "Only tenants can book viewings", code: "role" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_viewing_slot", {
    p_slot_id: slotId,
    p_party_size: partySize,
    p_note: note && note.trim() ? note.trim() : null,
  });
  if (error) {
    const msg = error.message.replace(/^.*:\s*/, "");
    const code = BOOK_ERROR_CODES.find(([re]) => re.test(error.message))?.[1];
    return { ok: false, error: msg, code };
  }

  revalidatePath("/dashboard/viewings");
  return { ok: true, message: "You're going! The viewing is confirmed.", data: { bookingId: data.id } };
}

export async function cancelBooking(bookingId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("viewing_bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("tenant_id", user.id)
    .eq("status", "confirmed");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/viewings");
  return { ok: true, message: "Booking cancelled" };
}
