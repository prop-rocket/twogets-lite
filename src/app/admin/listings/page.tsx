import Link from "next/link";

import { AdminListingStatusButton } from "@/components/admin/admin-actions";
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
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatRent } from "@/lib/utils";

export const metadata = { title: "Manage Listings" };

export default async function AdminListingsPage() {
  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("*, owner:users!properties_owner_id_fkey(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Listings</h1>
        <p className="text-muted-foreground">Most recent 200 listings across all owners.</p>
      </div>

      <div className="rounded-xl border">
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
            {(properties ?? []).map((property) => {
              const owner = property.owner as unknown as { full_name: string; email: string };
              return (
                <TableRow key={property.id}>
                  <TableCell>
                    <Link
                      href={`/properties/${property.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {property.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {property.locality}, {property.city}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{owner?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{owner?.email}</p>
                  </TableCell>
                  <TableCell>{formatRent(property.rent)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={property.status === "active" ? "success" : "secondary"}>
                        {PROPERTY_STATUS_LABELS[property.status]}
                      </Badge>
                      {property.is_verified && <VerifiedBadge kind="property" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(property.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <AdminListingStatusButton propertyId={property.id} status={property.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
