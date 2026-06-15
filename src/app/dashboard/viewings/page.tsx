import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, CalendarDays, Settings2 } from "lucide-react";

import { ReviewDialog } from "@/components/review/review-dialog";
import { CancelBookingButton } from "@/components/viewing/booking-actions";
import { OwnerSlotsList } from "@/components/viewing/owner-slots-list";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VIEWING_BOOKING_STATUS_LABELS } from "@/lib/constants";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { formatSlotDay, formatSlotRange } from "@/lib/utils";
import { getOwnerAgenda, getTenantBookings } from "@/server/queries";
import type { ViewingBookingStatus } from "@/types";

export const metadata = { title: "Viewings" };
export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<ViewingBookingStatus, "warning" | "success" | "destructive" | "secondary"> = {
  confirmed: "success",
  attended: "success",
  no_show: "destructive",
  cancelled: "secondary",
};

export default async function ViewingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // -------------------------------------------------------------- Owner view
  if (user.role === "homeowner") {
    const agenda = await getOwnerAgenda(user.id);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Viewings</h1>
          <p className="text-muted-foreground">
            Upcoming viewings across your listings. Manage availability from each listing.
          </p>
        </div>

        {agenda.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No upcoming viewings"
            description="Publish viewing slots on a listing and confirmed bookings will appear here."
            action={
              <Button asChild>
                <Link href="/dashboard/listings">Go to my listings</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-8">
            {agenda.map(({ property, slots }) => (
              <section key={property.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-xl font-semibold">
                    {property.title}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {property.locality}, {property.city}
                    </span>
                  </h2>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/listings/${property.id}/viewings`}>
                      <Settings2 className="size-4" />
                      Manage availability
                    </Link>
                  </Button>
                </div>
                <OwnerSlotsList slots={slots} propertyId={property.id} />
              </section>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------- Tenant view
  const bookings = await getTenantBookings(user.id);
  const supabase = await createClient();
  const bookingIds = bookings.map((b) => b.id);
  const { data: myReviews } = bookingIds.length
    ? await supabase.from("reviews").select("booking_id").eq("reviewer_id", user.id).in("booking_id", bookingIds)
    : { data: [] };
  const reviewed = new Set((myReviews ?? []).map((r) => r.booking_id));

  const now = Date.now();
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && new Date(b.slot.starts_at).getTime() > now,
  );
  const past = bookings.filter((b) => !upcoming.includes(b));

  function Row({ booking }: { booking: (typeof bookings)[number] }) {
    const upcomingConfirmed =
      booking.status === "confirmed" && new Date(booking.slot.starts_at).getTime() > now;
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-display text-lg font-semibold">
              <CalendarClock className="size-4 text-primary" />
              {formatSlotDay(booking.slot.starts_at)} · {formatSlotRange(booking.slot.starts_at, booking.slot.ends_at)}
            </p>
            <Badge variant={STATUS_VARIANT[booking.status]}>
              {VIEWING_BOOKING_STATUS_LABELS[booking.status]}
            </Badge>
          </div>
          <p className="text-sm">
            <Link href={`/properties/${booking.property.id}`} className="font-semibold text-primary hover:underline">
              {booking.property.title}
            </Link>
            <span className="text-muted-foreground">
              {" "}
              — {booking.property.locality}, {booking.property.city} · hosted by {booking.owner.full_name}
            </span>
          </p>
          {upcomingConfirmed && <CancelBookingButton bookingId={booking.id} />}
          {booking.status === "attended" &&
            (reviewed.has(booking.id) ? (
              <p className="text-sm text-muted-foreground">✓ You reviewed this viewing.</p>
            ) : (
              <ReviewDialog bookingId={booking.id} reviewType="owner_review" revieweeName={booking.owner.full_name} />
            ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">My viewings</h1>
        <p className="text-muted-foreground">Viewings you&apos;ve booked. Book new times from any listing.</p>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No viewings booked yet"
          description="Find a home you like and book one of the owner's published viewing times."
          action={
            <Button asChild>
              <Link href="/swipe">Find a home</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Upcoming</h2>
              <div className="space-y-4">
                {upcoming.map((b) => (
                  <Row key={b.id} booking={b} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Past</h2>
              <div className="space-y-4">
                {past.map((b) => (
                  <Row key={b.id} booking={b} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
