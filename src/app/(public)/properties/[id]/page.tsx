import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BedDouble,
  CalendarCheck,
  CalendarDays,
  Check,
  IndianRupee,
  MapPin,
  PawPrint,
  PlayCircle,
  Sofa,
  Users,
} from "lucide-react";

import { PropertyGallery } from "@/components/property/property-gallery";
import { SaveButton } from "@/components/property/save-button";
import { SlotPicker } from "@/components/viewing/slot-picker";
import { ReviewCard } from "@/components/review/review-card";
import { ReportDialog } from "@/components/shared/report-dialog";
import { StarRating } from "@/components/shared/star-rating";
import { TrustScore } from "@/components/shared/trust-score";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  FURNISHED_LABELS,
  OCCUPANCY_LABELS,
  PROPERTY_TYPE_LABELS,
} from "@/lib/constants";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { avatarUrl, formatDate, formatRent, initials } from "@/lib/utils";
import { getOpenSlots, getProperty, getPropertyReviews, isPropertySaved } from "@/server/queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) return { title: "Property not found" };
  return {
    title: `${property.title} — ${property.locality}, ${property.city}`,
    description: `${property.bhk} BHK ${PROPERTY_TYPE_LABELS[property.property_type]} for rent in ${property.locality}, ${property.city} at ${formatRent(property.rent)}/month on TwoGets.`,
  };
}

export default async function PropertyDetailsPage({ params }: { params: Params }) {
  const { id } = await params;
  const [property, user] = await Promise.all([getProperty(id), getCurrentUser()]);
  if (!property) notFound();

  const isOwner = user?.id === property.owner_id;
  if (property.status !== "active" && !isOwner && user?.role !== "admin") notFound();

  const [reviews, saved, slots] = await Promise.all([
    getPropertyReviews(property.id),
    user?.role === "tenant" ? isPropertySaved(property.id, user.id) : Promise.resolve(false),
    isOwner ? Promise.resolve([]) : getOpenSlots(property.id, user?.id),
  ]);

  // fire-and-forget view counter
  const supabase = await createClient();
  void supabase.rpc("increment_view_count", { pid: property.id }).then(() => {});

  const amenities = property.property_amenities.map((pa) => pa.amenity).filter(Boolean);

  const facts = [
    { icon: BedDouble, label: `${property.bhk} BHK · ${PROPERTY_TYPE_LABELS[property.property_type]}` },
    { icon: Sofa, label: FURNISHED_LABELS[property.furnished_status] },
    { icon: Users, label: `Preferred: ${OCCUPANCY_LABELS[property.preferred_tenants]}` },
    { icon: CalendarDays, label: `Available from ${formatDate(property.available_from)}` },
    ...(property.pet_friendly ? [{ icon: PawPrint, label: "Pet friendly" }] : []),
  ];

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {property.is_verified && <VerifiedBadge kind="property" />}
            {property.owner.is_verified && <VerifiedBadge kind="owner" />}
            {property.status !== "active" && (
              <Badge variant="warning">This listing is {property.status}</Badge>
            )}
          </div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">{property.title}</h1>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-4" />
            {property.address_line}, {property.locality}, {property.city}, {property.state} —{" "}
            {property.pincode}
          </p>
          <StarRating rating={Number(property.avg_rating)} count={property.review_count} />
        </div>
        <div className="flex items-center gap-2">
          {user?.role === "tenant" && (
            <SaveButton propertyId={property.id} initialSaved={saved} />
          )}
          <ReportDialog targetType="property" targetId={property.id} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: gallery + details */}
        <div className="space-y-8 lg:col-span-2">
          <PropertyGallery images={property.property_images} title={property.title} />

          {property.video_url && (
            <a
              href={property.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <PlayCircle className="size-4" />
              Watch video tour
            </a>
          )}

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold">About this home</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {facts.map((fact) => (
                <span key={fact.label} className="inline-flex items-center gap-1.5">
                  <fact.icon className="size-4 text-primary" />
                  {fact.label}
                </span>
              ))}
            </div>
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
              {property.description || "The owner hasn't added a description yet."}
            </p>
          </section>

          {amenities.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-2xl font-semibold">Amenities</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {amenities.map((amenity) => (
                  <span key={amenity.id} className="inline-flex items-center gap-2 text-sm">
                    <Check className="size-4 text-primary" />
                    {amenity.label}
                  </span>
                ))}
              </div>
            </section>
          )}

          <Separator />

          <section className="space-y-4">
            <h2 className="font-display text-2xl font-semibold">
              Reviews {property.review_count > 0 && `(${property.review_count})`}
            </h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No reviews yet. Reviews appear after completed viewings.
              </p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: rent card + owner card */}
        <div className="space-y-6">
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle className="flex items-baseline gap-1 font-display text-3xl text-primary">
                {formatRent(property.rent)}
                <span className="text-base font-normal text-muted-foreground">/month</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <IndianRupee className="size-3.5" />
                  Security deposit
                </span>
                <span className="font-semibold">{formatRent(property.deposit)}</span>
              </div>

              {isOwner ? (
                <div className="space-y-2">
                  <Button asChild className="w-full" variant="outline">
                    <Link href={`/dashboard/listings/${property.id}/edit`}>Edit your listing</Link>
                  </Button>
                  <Button asChild className="w-full" variant="ghost">
                    <Link href={`/dashboard/listings/${property.id}/viewings`}>Manage viewing times</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <CalendarCheck className="size-4 text-primary" />
                    Pick a viewing time
                  </p>
                  <SlotPicker
                    slots={slots}
                    canBook={user?.role === "tenant"}
                    loginHref={`/login?next=/properties/${property.id}`}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Listed by</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage
                    src={avatarUrl(property.owner.avatar_url) ?? undefined}
                    alt={property.owner.full_name}
                  />
                  <AvatarFallback>{initials(property.owner.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    {property.owner.full_name}
                    {property.owner.is_verified && <VerifiedBadge kind="owner" />}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Member since {formatDate(property.owner.created_at)}
                  </p>
                </div>
              </div>
              <TrustScore score={Number(property.owner.trust_score)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
