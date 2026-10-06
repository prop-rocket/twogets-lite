import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, EyeOff } from "lucide-react";

import { PropertyCard } from "@/components/property/property-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VIEWING_BOOKING_STATUS_LABELS } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { ViewingBookingStatus } from "@/types";

export const metadata = { title: "View as" };
export const dynamic = "force-dynamic";

/**
 * Read-only "what is this person seeing?", for support.
 *
 * Deliberately NOT a session swap. Signing in as someone would attribute every
 * subsequent write to them with no trace, leave RLS unable to tell the
 * difference, and become an account-takeover primitive if the admin gate ever
 * regressed. This renders their data server-side instead: no write actions, no
 * cookie another route reads, and never for another admin.
 */
export default async function ViewAsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") redirect("/dashboard");

  const db = createAdminClient();
  const { data: target } = await db.from("users").select("*").eq("id", id).maybeSingle();
  if (!target) notFound();
  if (target.role === "admin") redirect(`/admin/users/${id}`);

  await db.rpc("log_admin_action", {
    p_action: "user.viewed_as",
    p_entity_type: "user",
    p_entity_id: id,
    p_metadata: {},
  });

  const [saved, bookings, listings] = await Promise.all([
    db
      .from("saved_properties")
      .select("property:properties(*, property_images(*))")
      .eq("tenant_id", id)
      .limit(6),
    db
      .from("viewing_bookings")
      .select("id, status, created_at, property:properties!viewing_bookings_listing_id_fkey(title)")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("properties")
      .select("*, property_images(*)")
      .eq("owner_id", id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const savedProps = (saved.data ?? [])
    .map((r) => r.property)
    .filter(Boolean) as unknown as Parameters<typeof PropertyCard>[0]["property"][];

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/users/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to account
      </Link>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
        <EyeOff className="size-5 text-amber-600" />
        <div className="min-w-0">
          <p className="font-semibold">
            Viewing as {target.full_name || target.email} — read only
          </p>
          <p className="text-sm text-muted-foreground">
            You are still signed in as yourself. Nothing here can be changed, and this view was
            recorded in the audit log.
          </p>
        </div>
      </div>

      {listings.data && listings.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Their listings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(listings.data as unknown as Parameters<typeof PropertyCard>[0]["property"][]).map(
                (p) => (
                  <PropertyCard key={p.id} property={p} />
                ),
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Their shortlist</CardTitle>
        </CardHeader>
        <CardContent>
          {savedProps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing saved.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {savedProps.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Their viewings</CardTitle>
        </CardHeader>
        <CardContent>
          {!bookings.data?.length ? (
            <p className="text-sm text-muted-foreground">No viewings.</p>
          ) : (
            bookings.data.map((b) => {
              const prop = b.property as unknown as { title: string } | null;
              return (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0"
                >
                  <span>{prop?.title ?? "—"}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant="secondary">
                      {VIEWING_BOOKING_STATUS_LABELS[b.status as ViewingBookingStatus] ?? b.status}
                    </Badge>
                    {formatDate(b.created_at)}
                  </span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
