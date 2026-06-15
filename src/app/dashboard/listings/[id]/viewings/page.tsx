import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarClock } from "lucide-react";

import { AvailabilityManager } from "@/components/viewing/availability-manager";
import { OwnerSlotsList } from "@/components/viewing/owner-slots-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getListingViewings } from "@/server/queries";

export const metadata = { title: "Manage Viewings" };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function ListingViewingsPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "homeowner") redirect("/dashboard");

  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id, title, locality, city")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!property) notFound();

  const { slots } = await getListingViewings(property.id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/listings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          My listings
        </Link>
        <h1 className="mt-1 font-display text-3xl font-bold">Viewings</h1>
        <p className="text-muted-foreground">
          {property.title} — {property.locality}, {property.city}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="lg:sticky lg:top-20 lg:self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <CalendarClock className="size-5 text-primary" />
              Publish availability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AvailabilityManager propertyId={property.id} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Your slots</h2>
          <OwnerSlotsList slots={slots} propertyId={property.id} />
        </div>
      </div>
    </div>
  );
}
