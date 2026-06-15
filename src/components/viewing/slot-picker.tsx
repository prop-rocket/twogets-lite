"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Check, Loader2, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bookSlot, cancelBooking } from "@/server/actions/viewings";
import { cn, dayKeyParts, formatSlotRange, istDayKey } from "@/lib/utils";
import type { TenantSlot } from "@/types";

// Only ever surface the next few published dates so the picker stays light;
// the window rolls forward on its own as past slots drop out of the query.
const MAX_DATES = 5;

/**
 * Tenant-facing slot picker — date-first. We show only the dates the owner has
 * actually published slots for (capped at the next five), preselecting the
 * earliest. Tapping a date reveals that day's open slots. Booking is one-tap
 * and auto-confirmed (no custom time entry anywhere).
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

  // The next published dates (IST, sorted, capped) that drive the chips.
  const days = React.useMemo(
    () => [...new Set(slots.map((s) => istDayKey(s.starts_at)))].sort().slice(0, MAX_DATES),
    [slots],
  );

  const [selectedDate, setSelectedDate] = React.useState(
    () => [...new Set(initialSlots.map((s) => istDayKey(s.starts_at)))].sort()[0] ?? "",
  );

  // When the parent hands us a fresh slot set (e.g. switching homes in the
  // swipe sheet), resync and jump to the earliest available date.
  React.useEffect(() => {
    setSlots(initialSlots);
    const next = [...new Set(initialSlots.map((s) => istDayKey(s.starts_at)))].sort();
    setSelectedDate(next[0] ?? "");
  }, [initialSlots]);

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

  const daySlots = slots
    .filter((s) => istDayKey(s.starts_at) === selectedDate)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <div className="space-y-4">
      {/* Step 1 — pick a date */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Pick a date</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => {
            const parts = dayKeyParts(day);
            const active = day === selectedDate;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "flex w-16 shrink-0 flex-col items-center rounded-xl border py-2 text-center transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:border-primary hover:text-primary",
                )}
              >
                <span className="text-[11px] uppercase opacity-80">{parts.weekday}</span>
                <span className="text-lg font-semibold leading-tight">{parts.day}</span>
                <span className="text-[11px] uppercase opacity-80">{parts.month}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2 — slots for the chosen date */}
      {daySlots.length === 0 ? (
        <p className="text-sm text-muted-foreground">Select a date to see available times.</p>
      ) : (
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
      )}
    </div>
  );
}
