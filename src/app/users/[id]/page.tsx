import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Briefcase, CalendarDays, Dog, Languages, MapPin, Wallet } from "lucide-react";

import { PropertyCard } from "@/components/property/property-card";
import { ReviewCard } from "@/components/review/review-card";
import { StarRating } from "@/components/shared/star-rating";
import { TrustScore } from "@/components/shared/trust-score";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  FOOD_LABELS,
  INCOME_LABELS,
  OCCUPANCY_LABELS,
} from "@/lib/constants";
import { avatarUrl, formatDate, formatRent, initials } from "@/lib/utils";
import { getPublicProfile } from "@/server/queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  return { title: profile ? profile.user.full_name : "Profile" };
}

function Fact({ icon: Icon, label }: { icon: typeof Briefcase; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Icon className="size-4 text-primary" />
      {label}
    </span>
  );
}

export default async function PublicProfilePage({ params }: { params: Params }) {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) notFound();

  const { user, renterProfile, hostProfile, listings, reviews } = profile;
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + Number(r.overall_rating), 0) / reviews.length
      : 0;

  return (
    <div className="container mx-auto max-w-3xl space-y-8 px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4">
        <Avatar className="size-20">
          <AvatarImage src={avatarUrl(user.avatar_url) ?? undefined} alt={user.full_name} />
          <AvatarFallback className="text-xl">{initials(user.full_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold">{user.full_name}</h1>
            {user.is_verified && <VerifiedBadge />}
          </div>
          <p className="text-sm text-muted-foreground">
            Member since {formatDate(user.created_at)}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <TrustScore score={Number(user.letting_trust_score)} variant="letting" />
            <TrustScore score={Number(user.renting_trust_score)} variant="renting" />
          </div>
          {reviews.length > 0 && <StarRating rating={avgRating} count={reviews.length} />}
        </div>
      </div>

      {/* Host side */}
      {hostProfile && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">As a host</h2>
          {hostProfile.about && <p className="text-muted-foreground">{hostProfile.about}</p>}
          {hostProfile.city && <Fact icon={MapPin} label={hostProfile.city} />}
        </section>
      )}

      {/* Renter side — only present when RLS allowed it through */}
      {renterProfile ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">As a renter</h2>
          {renterProfile.about && <p className="text-muted-foreground">{renterProfile.about}</p>}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {renterProfile.occupation && (
              <Fact
                icon={Briefcase}
                label={
                  renterProfile.employer
                    ? `${renterProfile.occupation} at ${renterProfile.employer}`
                    : renterProfile.occupation
                }
              />
            )}
            {renterProfile.income_range && (
              <Fact icon={Wallet} label={INCOME_LABELS[renterProfile.income_range]} />
            )}
            <Fact icon={Languages} label={OCCUPANCY_LABELS[renterProfile.occupancy_type]} />
            <Fact
              icon={Dog}
              label={renterProfile.has_pets ? "Has pets" : "No pets"}
            />
            <Fact
              icon={Languages}
              label={FOOD_LABELS[renterProfile.food_preference]}
            />
            {renterProfile.move_in_date && (
              <Fact icon={CalendarDays} label={`Moving ${formatDate(renterProfile.move_in_date)}`} />
            )}
            {renterProfile.budget_max != null && (
              <Fact
                icon={Wallet}
                label={`Budget up to ${formatRent(renterProfile.budget_max)}`}
              />
            )}
          </div>
          {renterProfile.preferred_locations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {renterProfile.preferred_locations.map((loc) => (
                <Badge key={loc} variant="secondary">
                  {loc}
                </Badge>
              ))}
            </div>
          )}
        </section>
      ) : (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            Renter details are shared with hosts once this person requests a viewing on their
            listing.
          </CardContent>
        </Card>
      )}

      {/* Their listings */}
      {listings.length > 0 && (
        <section className="space-y-4">
          <Separator />
          <h2 className="font-display text-xl font-semibold">Listings</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {listings.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="space-y-4">
        <Separator />
        <h2 className="font-display text-xl font-semibold">
          Reviews {reviews.length > 0 && `(${reviews.length})`}
        </h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
