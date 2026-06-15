"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Users, X } from "lucide-react";
import { toast } from "sonner";

import { ReviewDialog } from "@/components/review/review-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { VIEWING_BOOKING_STATUS_LABELS } from "@/lib/constants";
import { avatarUrl, formatSlotDay, formatSlotRange, initials, istDayKey } from "@/lib/utils";
import { cancelSlot, setAttendance } from "@/server/actions/viewings";
import type { BookingAttendee, OwnerSlot } from "@/types";

function AttendeeRow({
  attendee,
  isPast,
  propertyId,
}: {
  attendee: BookingAttendee;
  isPast: boolean;
  propertyId: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function mark(status: BookingAttendee["status"]) {
    start(async () => {
      const result = await setAttendance(attendee.id, status, propertyId);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
      <div className="flex items-center gap-2">
        <Avatar className="size-7">
          <AvatarImage src={avatarUrl(attendee.tenant.avatar_url) ?? undefined} alt="" />
          <AvatarFallback>{initials(attendee.tenant.full_name)}</AvatarFallback>
        </Avatar>
        <div className="text-sm">
          <span className="font-medium">{attendee.tenant.full_name}</span>
          {attendee.party_size > 1 && (
            <span className="text-muted-foreground"> · party of {attendee.party_size}</span>
          )}
          {attendee.status !== "confirmed" && (
            <Badge variant="secondary" className="ml-2">
              {VIEWING_BOOKING_STATUS_LABELS[attendee.status]}
            </Badge>
          )}
        </div>
      </div>

      {isPast && (
        <div className="flex items-center gap-2">
          {attendee.status === "attended" ? (
            <ReviewDialog bookingId={attendee.id} reviewType="tenant_review" revieweeName={attendee.tenant.full_name} />
          ) : (
            <>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => mark("attended")}>
                Attended
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => mark("no_show")}>
                No-show
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SlotCard({ slot, propertyId }: { slot: OwnerSlot; propertyId: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const isPast = new Date(slot.starts_at) <= new Date();
  const confirmed = slot.attendees.filter((a) => a.status === "confirmed");
  const shown = slot.attendees.slice(0, 5);

  function cancel() {
    start(async () => {
      const result = await cancelSlot(slot.id, propertyId);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 font-semibold">
            <CalendarClock className="size-4 text-primary" />
            {formatSlotRange(slot.starts_at, slot.ends_at)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            {slot.going_count} going
            {slot.capacity != null ? ` of ${slot.capacity}` : " · unlimited"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {slot.attendees.length > 0 && (
            <div className="flex -space-x-2">
              {shown.map((a) => (
                <Avatar key={a.id} className="size-7 ring-2 ring-background">
                  <AvatarImage src={avatarUrl(a.tenant.avatar_url) ?? undefined} alt="" />
                  <AvatarFallback>{initials(a.tenant.full_name)}</AvatarFallback>
                </Avatar>
              ))}
              {slot.attendees.length > 5 && (
                <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs ring-2 ring-background">
                  +{slot.attendees.length - 5}
                </span>
              )}
            </div>
          )}
          {!isPast && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={cancel}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              Cancel slot
            </Button>
          )}
        </div>
      </div>

      {slot.capacity != null && (
        <Progress value={Math.min(100, (confirmed.length / slot.capacity) * 100)} />
      )}

      {slot.attendees.length > 0 ? (
        <div className="space-y-1.5">
          {slot.attendees.map((a) => (
            <AttendeeRow key={a.id} attendee={a} isPast={isPast} propertyId={propertyId} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No bookings yet.</p>
      )}
    </div>
  );
}

export function OwnerSlotsList({ slots, propertyId }: { slots: OwnerSlot[]; propertyId: string }) {
  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No viewing slots yet. Publish availability above to start taking bookings.
      </div>
    );
  }

  const groups = new Map<string, OwnerSlot[]>();
  for (const s of slots) {
    const key = istDayKey(s.starts_at);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(s);
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([day, daySlots]) => (
        <div key={day} className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {formatSlotDay(daySlots[0]!.starts_at)}
          </p>
          <div className="space-y-3">
            {daySlots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} propertyId={propertyId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
