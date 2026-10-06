import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BanUserButton, UserPlanButton } from "@/components/admin/admin-actions";
import { TrustScore } from "@/components/shared/trust-score";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OWNER_RELATIONSHIP_LABELS,
  PROPERTY_STATUS_LABELS,
  VIEWING_BOOKING_STATUS_LABELS,
} from "@/lib/constants";
import { avatarUrl, formatDate, formatRent, initials } from "@/lib/utils";
import { getAdminUserDetail } from "@/server/admin-queries";
import type { ViewingBookingStatus } from "@/types";

export const metadata = { title: "User detail" };
export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getAdminUserDetail(id);
  if (!detail) notFound();

  const { user, tenantProfile, homeownerProfile, listings, bookings, reports, auditLog } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All users
      </Link>

      {/* Identity + actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage src={avatarUrl(user.avatar_url) ?? undefined} alt="" />
            <AvatarFallback>{initials(user.full_name || user.email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold">{user.full_name || "—"}</h1>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {user.role ?? "no role"}
              </Badge>
              {user.can_host && <Badge variant="accent">Can host</Badge>}
              {(user.plan ?? "free") === "plus" && <Badge variant="accent">Plus</Badge>}
              {user.is_verified && <VerifiedBadge />}
              {user.is_banned && <Badge variant="destructive">Banned</Badge>}
            </div>
          </div>
        </div>
        {user.role !== "admin" && (
          <div className="flex flex-wrap gap-2">
            <UserPlanButton userId={user.id} plan={user.plan ?? "free"} />
            <BanUserButton userId={user.id} isBanned={user.is_banned} />
          </div>
        )}
      </div>

      {/* Reputation + activity */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Listings" value={listings.length} />
        <Stat label="Viewings booked" value={bookings.length} />
        <Stat label="Reviews received" value={detail.reviewsReceived} />
        <Stat label="Shortlisted" value={detail.shortlists} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Reputation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6">
          <TrustScore score={Number(user.letting_trust_score)} variant="letting" />
          <TrustScore score={Number(user.renting_trust_score)} variant="renting" />
          <span className="text-sm text-muted-foreground">
            {detail.reviewsWritten} written · {detail.swipes} swipes · joined{" "}
            {formatDate(user.created_at)}
          </span>
        </CardContent>
      </Card>

      {/* Profiles — one account can legitimately have both */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Renter profile</CardTitle>
          </CardHeader>
          <CardContent>
            {!tenantProfile ? (
              <p className="text-sm text-muted-foreground">Not filled in.</p>
            ) : (
              <div>
                <Row label="Occupation" value={tenantProfile.occupation} />
                <Row label="Employer" value={tenantProfile.employer} />
                <Row label="Income" value={tenantProfile.income_range} />
                <Row label="Occupancy" value={tenantProfile.occupancy_type} />
                <Row label="Pets" value={tenantProfile.has_pets ? "Yes" : "No"} />
                <Row
                  label="Budget"
                  value={
                    tenantProfile.budget_max
                      ? `${formatRent(tenantProfile.budget_min ?? 0)} – ${formatRent(tenantProfile.budget_max)}`
                      : null
                  }
                />
                <Row label="Move-in" value={tenantProfile.move_in_date} />
                <Row label="Locations" value={tenantProfile.preferred_locations.join(", ")} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Host profile</CardTitle>
          </CardHeader>
          <CardContent>
            {!homeownerProfile ? (
              <p className="text-sm text-muted-foreground">Not filled in.</p>
            ) : (
              <div>
                <Row label="City" value={homeownerProfile.city} />
                <Row label="LinkedIn" value={homeownerProfile.linkedin_url} />
                <Row label="About" value={homeownerProfile.about} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Listings */}
      {listings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Listings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {listings.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
                <Link href={`/admin/listings/${l.id}`} className="font-medium text-primary hover:underline">
                  {l.title}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">{PROPERTY_STATUS_LABELS[l.status]}</Badge>
                  <Badge variant="secondary">{l.listing_kind === "roommate" ? "Flatmate" : OWNER_RELATIONSHIP_LABELS[l.owner_relationship]}</Badge>
                  {l.is_verified && <VerifiedBadge kind="property" />}
                  <span>{formatRent(l.rent)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Bookings */}
      {bookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Viewings booked</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bookings.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0">
                <span>{b.property?.title ?? "—"}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="secondary">
                    {VIEWING_BOOKING_STATUS_LABELS[b.status as ViewingBookingStatus] ?? b.status}
                  </Badge>
                  {formatDate(b.created_at)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reports + audit */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Reports against them</CardTitle>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="border-b py-2 text-sm last:border-0">
                  <p className="font-medium">
                    {r.reason} <Badge variant="secondary" className="ml-1 capitalize">{r.status}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    by {r.reporter?.full_name} · {formatDate(r.created_at)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Admin actions on this account</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing recorded.</p>
            ) : (
              auditLog.map((a) => (
                <div key={a.id} className="flex justify-between gap-2 border-b py-2 text-sm last:border-0">
                  <span className="font-mono text-xs">{a.action}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
