"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Check, Loader2, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bookSlot, cancelBooking } from "@/server/actions/viewings";
import { formatSlotDay, formatSlotRange, istDayKey } from "@/lib/utils";
import type { TenantSlot } from "@/types";

/**
 * Tenant-facing slot picker. Shows the owner's open future slots grouped by day;
 * booking is one-tap and auto-confirmed (no custom time entry anywhere). Full
 * slots are labelled and disabled; the tenant can cancel their own booking.
 */
export function SlotPicker({
  slots: initialSlots,
  canBook,
  loginHref,
}: {
  slots: TenantSlot[];
  canBook: boolean;
  loginHref: string;
}) {
  const [slots, setSlots] = React.useState(initialSlots);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  React.useEffect(() => setSlots(initialSlots), [initialSlots]);

  function patch(slotId: string, fn: (s: TenantSlot) => TenantSlot) {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? fn(s) : s)));
  }

  async function book(slot: TenantSlot) {
    setPendingId(slot.id);
    const result = await bookSlot(slot.id, 1);
    setPendingId(null);
    if (result.ok && result.data) {
      const bookingId = result.data.bookingId;
      patch(slot.id, (s) => ({
        ...s,
        my_booking: { id: bookingId, status: "confirmed" },
        going_count: s.going_count + 1,
        spots_left: s.spots_left == null ? null : Math.max(0, s.spots_left - 1),
        is_full: s.capacity != null && s.going_count + 1 >= s.capacity,
      }));
      toast.success(result.message);
    } else if (!result.ok) {
      if (result.code === "full") patch(slot.id, (s) => ({ ...s, is_full: true, spots_left: 0 }));
      toast.error(result.error);
    }
  }

  async function cancel(slot: TenantSlot) {
    if (!slot.my_booking) return;
    setPendingId(slot.id);
    const result = await cancelBooking(slot.my_booking.id);
    setPendingId(null);
    if (result.ok) {
      patch(slot.id, (s) => ({
        ...s,
        my_booking: null,
        going_count: Math.max(0, s.going_count - 1),
        spots_left: s.spots_left == null ? null : s.spots_left + 1,
        is_full: false,
      }));
      toast.success(result.message);
    } else {
      toast.error(result.error);
    }
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        The owner hasn&apos;t published any viewing times yet. Save the home and check back soon.
      </div>
    );
  }

  // Group by IST calendar day.
  const groups = new Map<string, TenantSlot[]>();
  for (const s of slots) {
    const key = istDayKey(s.starts_at);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(s);
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([day, daySlots]) => (
        <div key={day} className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {formatSlotDay(daySlots[0]!.starts_at)}
          </p>
          <div className="space-y-2">
            {daySlots.map((slot) => {
              const booked = Boolean(slot.my_booking);
              const pending = pendingId === slot.id;
              return (
                <div
                  key={slot.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium">
                      <CalendarClock className="size-4 text-primary" />
                      {formatSlotRange(slot.starts_at, slot.ends_at)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" />
                        {slot.going_count} going
                      </span>
                      {slot.capacity != null && (
                        <span>
                          ·{" "}
                          {slot.is_full && !booked
                            ? "Full"
                            : `${slot.spots_left} spot${slot.spots_left === 1 ? "" : "s"} left`}
                        </span>
                      )}
                    </p>
                  </div>

                  {!canBook ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={loginHref}>Sign in to book</Link>
                    </Button>
                  ) : booked ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="success" className="gap-1">
                        <Check className="size-3.5" />
                        You&apos;re going
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => cancel(slot)}
                        aria-label="Cancel booking"
                      >
                        {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                      </Button>
                    </div>
                  ) : slot.is_full ? (
                    <Button size="sm" variant="outline" disabled>
                      Full
                    </Button>
                  ) : (
                    <Button size="sm" disabled={pending} onClick={() => book(slot)}>
                      {pending ? <Loader2 className="size-4 animate-spin" /> : "Book viewing"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
