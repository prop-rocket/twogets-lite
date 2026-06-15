import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CalendarClock, Eye, Heart, Plus, Star } from "lucide-react";

import { ListingActions } from "@/components/listing/listing-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PROPERTY_STATUS_LABELS } from "@/lib/constants";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { formatRent, publicMediaUrl } from "@/lib/utils";
import { getShortlistCounts } from "@/server/queries";
import type { PropertyStatus, PropertyWithImages } from "@/types";

export const metadata = { title: "My Listings" };

const STATUS_VARIANT: Record<PropertyStatus, "success" | "secondary" | "warning"> = {
  active: "success",
  draft: "secondary",
  archived: "secondary",
  rented: "warning",
};

export default async function ListingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "homeowner") redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("*, property_images(*)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const properties = (data ?? []) as unknown as PropertyWithImages[];
  const shortlists = await getShortlistCounts(properties.map((p) => p.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">My listings</h1>
          <p className="text-muted-foreground">Create, edit, archive or delete your properties.</p>
        </div>
        <Button asChild variant="accent">
          <Link href="/dashboard/listings/new">
            <Plus />
            New listing
          </Link>
        </Button>
      </div>

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No listings yet"
          description="Add your first property — it takes about five minutes."
          action={
            <Button asChild>
              <Link href="/dashboard/listings/new">Create listing</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {properties.map((property) => {
            const cover =
              property.property_images.find((i) => i.is_cover) ?? property.property_images[0];
            return (
              <Card key={property.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-lg bg-secondary sm:w-36">
                    {cover ? (
                      <Image
                        src={publicMediaUrl(cover.storage_path)}
                        alt={property.title}
                        fill
                        sizes="144px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/properties/${property.id}`}
                        className="truncate font-display text-lg font-semibold hover:text-primary"
                      >
                        {property.title}
                      </Link>
                      <Badge variant={STATUS_VARIANT[property.status]}>
                        {PROPERTY_STATUS_LABELS[property.status]}
                      </Badge>
                      {property.is_verified && <VerifiedBadge kind="property" />}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {property.locality}, {property.city} · {formatRent(property.rent)}/mo
                    </p>
                    <p className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="size-3.5" />
                        {property.view_count} views
                      </span>
                      {(shortlists[property.id] ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 font-medium text-primary">
                          <Heart className="size-3.5" />
                          {shortlists[property.id]} shortlisted
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-3.5" />
                        {Number(property.avg_rating) > 0
                          ? `${Number(property.avg_rating).toFixed(1)} (${property.review_count})`
                          : "No reviews"}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/listings/${property.id}/viewings`}>
                        <CalendarClock className="size-4" />
                        Viewings
                      </Link>
                    </Button>
                    <ListingActions propertyId={property.id} status={property.status} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
