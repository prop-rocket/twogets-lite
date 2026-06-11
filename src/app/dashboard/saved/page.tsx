import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";

import { PropertyCard } from "@/components/property/property-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { PropertyListItem } from "@/types";

export const metadata = { title: "Saved Properties" };

export default async function SavedPropertiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "tenant") redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_properties")
    .select(
      "created_at, property:properties(*, property_images(*), owner:users!properties_owner_id_fkey(id, full_name, avatar_url, is_verified, trust_score, role, created_at))",
    )
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false });

  const properties = (data ?? [])
    .map((row) => row.property as unknown as PropertyListItem)
    .filter((p) => p && p.status === "active");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Saved properties</h1>
        <p className="text-muted-foreground">Homes you&apos;ve shortlisted.</p>
      </div>

      {properties.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          description="Tap the heart on any listing to keep it here."
          action={
            <Button asChild>
              <Link href="/properties">Browse homes</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}
