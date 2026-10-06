import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import {
  AdminBookingStatusSelect,
  AdminListingStatusButton,
  OwnerConfirmButton,
} from "@/components/admin/admin-actions";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  OWNER_RELATIONSHIP_LABELS,
  listingBadgeKind,
  needsOwnerCall,
} from "@/lib/constants";
import { describeSize, formatDate, formatRent, publicMediaUrl } from "@/lib/utils";
import { getAdminListingDetail } from "@/server/admin-queries";
import type { ViewingBookingStatus } from "@/types";

export const metadata = { title: "Listing detail" };
export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

export default async function AdminListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getAdminListingDetail(id);
  if (!detail) notFound();

  const { property, bookings, reports, auditLog } = detail;
  const cover = property.property_images?.find((i) => i.is_cover) ?? property.property_images?.[0];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/listings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All listings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          {cover && (
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
              <Image
                src={publicMediaUrl(cover.storage_path)}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold">{property.title}</h1>
            <p className="text-sm text-muted-foreground">
              {describeSize(
                property.bhk,
                property.property_type,
                PROPERTY_TYPE_LABELS[property.property_type],
              )}{" "}
              · {property.locality}, {property.city} · {formatRent(property.rent)}/mo
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={property.status === "active" ? "success" : "secondary"}>
                {PROPERTY_STATUS_LABELS[property.status]}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {property.listing_kind === "roommate"
                  ? "Flatmate"
                  : OWNER_RELATIONSHIP_LABELS[property.owner_relationship]}
              </Badge>
              {property.is_shared_home && <Badge variant="secondary">Shared home</Badge>}
              {property.is_verified && (
                <VerifiedBadge
                  kind={listingBadgeKind(property.listing_kind, property.owner_relationship)}
                />
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/properties/${property.id}`}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="size-4" />
            Public page
          </Link>
          {needsOwnerCall(property.listing_kind, property.owner_relationship) && (
            <OwnerConfirmButton
              propertyId={property.id}
              confirmed={Boolean(property.owner_confirmed_at)}
            />
          )}
          <AdminListingStatusButton propertyId={property.id} status={property.status} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Views" value={property.view_count} />
        <Stat label="Shortlisted" value={detail.shortlists} />
        <Stat label="Viewings" value={bookings.length} />
        <Stat label="Reviews" value={detail.reviewCount} />
      </div>

      {needsOwnerCall(property.listing_kind, property.owner_relationship) && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Owner to call</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{property.owner_contact_name ?? "—"}</p>
            <p className="text-muted-foreground">{property.owner_contact_phone ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {property.owner_confirmed_at
                ? `Confirmed ${formatDate(property.owner_confirmed_at)}`
                : "Not yet confirmed — the listing can't be verified until this call is made."}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Listed by</CardTitle>
        </CardHeader>
        <CardContent>
          {property.owner ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/admin/users/${property.owner.id}`}
                className="font-medium text-primary hover:underline"
              >
                {property.owner.full_name}
              </Link>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                {property.owner.email}
                {property.owner.is_verified && <VerifiedBadge />}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Owner account removed.</p>
          )}
        </CardContent>
      </Card>

      {bookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Viewings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0"
              >
                {b.tenant ? (
                  <Link
                    href={`/admin/users/${b.tenant.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {b.tenant.full_name}
                  </Link>
                ) : (
                  <span>—</span>
                )}
                <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  {formatDate(b.created_at)}
                  <AdminBookingStatusSelect
                    bookingId={b.id}
                    status={b.status as ViewingBookingStatus}
                    propertyId={property.id}
                  />
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Reports</CardTitle>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="border-b py-2 text-sm last:border-0">
                  <p className="font-medium">
                    {r.reason}{" "}
                    <Badge variant="secondary" className="ml-1 capitalize">
                      {r.status}
                    </Badge>
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
            <CardTitle className="font-display text-lg">History</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing recorded.</p>
            ) : (
              auditLog.map((a) => (
                <div
                  key={a.id}
                  className="flex justify-between gap-2 border-b py-2 text-sm last:border-0"
                >
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
