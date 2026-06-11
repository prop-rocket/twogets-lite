import type { Metadata } from "next";
import { SearchX } from "lucide-react";

import { PropertyCard } from "@/components/property/property-card";
import { PropertyFilters } from "@/components/property/property-filters";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { searchProperties, type PropertySearchParams } from "@/server/queries";
import type { SortOption } from "@/lib/constants";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const city = typeof params.city === "string" ? params.city : undefined;
  return {
    title: city ? `Homes for rent in ${city}` : "Browse Verified Homes for Rent",
    description: `Find verified ${city ? `rental homes in ${city}` : "rental homes across India"} — filter by BHK, budget, furnishing and pet policy on TwoGets.`,
  };
}

function str(v: string | string[] | undefined) {
  return typeof v === "string" && v.length ? v : undefined;
}

function num(v: string | string[] | undefined) {
  const n = Number(str(v));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const query: PropertySearchParams = {
    q: str(params.q),
    city: str(params.city),
    bhk: num(params.bhk),
    minRent: num(params.minRent),
    maxRent: num(params.maxRent),
    furnished: str(params.furnished),
    petFriendly: params.petFriendly === "1",
    verifiedOwner: params.verifiedOwner === "1",
    sort: (str(params.sort) as SortOption) ?? "newest",
    page: num(params.page) ?? 1,
  };

  const { properties, total, page, pageCount } = await searchProperties(query);

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold">
          {query.city ? `Homes in ${query.city}` : "Browse homes"}
        </h1>
        <p className="text-muted-foreground">
          {total} verified {total === 1 ? "listing" : "listings"} from trusted owners
        </p>
      </div>

      <PropertyFilters />

      {properties.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No homes match these filters"
          description="Try widening your budget, removing a filter, or searching a nearby locality."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} searchParams={params} />
    </div>
  );
}
