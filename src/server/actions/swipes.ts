"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { ActionResult, RecordSwipeResult, SwipeDirection } from "@/types";

const swipeSchema = z.object({
  propertyId: z.string().uuid(),
  direction: z.enum(["left", "right"]),
});

const ERROR_MESSAGES: Record<string, string> = {
  auth: "Sign in to start swiping",
  role: "Swiping is for tenants — homeowners manage listings from the dashboard",
  banned: "Your account is suspended",
  gone: "This listing is no longer available",
  quota: "You've used today's 3 free shortlists",
};

export async function recordSwipe(
  propertyId: string,
  direction: SwipeDirection,
): Promise<ActionResult<{ remaining: number | null; rightToday: number }>> {
  const parsed = swipeSchema.safeParse({ propertyId, direction });
  if (!parsed.success) return { ok: false, error: "Invalid swipe" };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: ERROR_MESSAGES.auth, code: "auth" };
  if (user.role !== "tenant") return { ok: false, error: ERROR_MESSAGES.role, code: "role" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_swipe", {
    p_property_id: parsed.data.propertyId,
    p_direction: parsed.data.direction,
  });

  if (error) {
    console.error("recordSwipe:", error.message);
    return {
      ok: false,
      error: "Swiping isn't set up yet — the database migration is pending",
      code: "unavailable",
    };
  }

  const result = data as RecordSwipeResult;
  if (!result.ok) {
    const code = result.code ?? "unknown";
    return { ok: false, error: ERROR_MESSAGES[code] ?? "Could not record swipe", code };
  }

  if (parsed.data.direction === "right") revalidatePath("/dashboard/saved");

  return {
    ok: true,
    data: { remaining: result.remaining ?? null, rightToday: result.right_today ?? 0 },
  };
}
