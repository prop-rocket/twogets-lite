import Link from "next/link";
import { Building2 } from "lucide-react";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminListingStatusButton, ExportButton } from "@/components/admin/admin-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PROPERTY_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatRent } from "@/lib/utils";
import { listAdminListings, listingCities, type AdminListing } from "@/server/admin-queries";
import type { PropertyStatus } from "@/types";

export const metadata = { title: "Manage Listings" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
const bool = (v: string | string[] | undefined) =>
  v === "yes" ? true : v === "no" ? false : undefined;

function StatusBadges({ property }: { property: AdminListing }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={property.status === "active" ? "success" : "secondary"}>
        {PROPERTY_STATUS_LABELS[property.status]}
      </Badge>
      {property.is_verified && <VerifiedBadge kind="property" />}
    </div>
  );
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [{ rows, total, page, pageCount }, cities] = await Promise.all([
    listAdminListings({
      q: str(params.q),
      city: str(params.city),
      status: str(params.status) as PropertyStatus | undefined,
      verified: bool(params.verified),
      page: Number(str(params.page) ?? 1),
    }),
    listingCities(),
  ]);

  const filters = [
    { type: "search" as const, key: "q", placeholder: "Search title, locality or city" },
    {
      type: "select" as const,
      key: "status",
      label: "Status",
      options: Object.entries(PROPERTY_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      type: "select" as const,
      key: "city",
      label: "City",
      options: cities.map((c) => ({ value: c, label: c })),
    },
    {
      type: "select" as const,
      key: "verified",
      label: "Verified",
      options: [
        { value: "yes", label: "Verified" },
        { value: "no", label: "Unverified" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Listings</h1>
          <p className="text-muted-foreground">
            {total} {total === 1 ? "listing" : "listings"} match these filters.
          </p>
        </div>
        <ExportButton dataset="listings" />
      </div>

      <AdminFilterBar fields={filters} />

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No listings match these filters"
          description="Try clearing the search or widening the filters."
        />
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Rent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell>
                      <Link
                        href={`/admin/listings/${property.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {property.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {property.locality}, {property.city}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{property.owner?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{property.owner?.email}</p>
                    </TableCell>
                    <TableCell>{formatRent(property.rent)}</TableCell>
                    <TableCell>
                      <StatusBadges property={property} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(property.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <AdminListingStatusButton propertyId={property.id} status={property.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((property) => (
              <div key={property.id} className="space-y-3 rounded-xl border p-4">
                <div>
                  <Link
                    href={`/admin/listings/${property.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {property.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {property.locality}, {property.city} · {formatRent(property.rent)}
                  </p>
                </div>
                <StatusBadges property={property} />
                <p className="text-xs text-muted-foreground">
                  {property.owner?.full_name} · {formatDate(property.created_at)}
                </p>
                <AdminListingStatusButton propertyId={property.id} status={property.status} />
              </div>
            ))}
          </div>
        </>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        searchParams={params}
        basePath="/admin/listings"
      />
    </div>
  );
}
