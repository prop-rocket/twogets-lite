import "server-only";

import { createClient } from "@/lib/supabase/server";
import { FREE_DAILY_RIGHT_SWIPES, PAGE_SIZE, SWIPE_DECK_SIZE, type SortOption } from "@/lib/constants";
import type { ParsedSearch } from "@/lib/nl-search";
import type { PropertyDetails, PropertyListItem, ReviewWithReviewer, SwipeCardItem, UserRow } from "@/types";

export interface PropertySearchParams {
  q?: string;
  city?: string;
  bhk?: number;
  minRent?: number;
  maxRent?: number;
  furnished?: string;
  petFriendly?: boolean;
  verifiedOwner?: boolean;
  sort?: SortOption;
  page?: number;
}

const LIST_SELECT =
  "*, property_images(*), owner:users!properties_owner_id_fkey(id, full_name, avatar_url, is_verified, trust_score, role, created_at)";

export async function searchProperties(params: PropertySearchParams) {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("properties")
    .select(LIST_SELECT, { count: "exact" })
    .eq("status", "active");

  if (params.q) {
    query = query.textSearch("search_vector", params.q.trim().split(/\s+/).join(" & "));
  }
  if (params.city) query = query.ilike("city", `%${params.city}%`);
  if (params.bhk) query = params.bhk >= 4 ? query.gte("bhk", 4) : query.eq("bhk", params.bhk);
  if (params.minRent) query = query.gte("rent", params.minRent);
  if (params.maxRent) query = query.lte("rent", params.maxRent);
  if (
    params.furnished === "unfurnished" ||
    params.furnished === "semi_furnished" ||
    params.furnished === "fully_furnished"
  ) {
    query = query.eq("furnished_status", params.furnished);
  }
  if (params.petFriendly) query = query.eq("pet_friendly", true);
  if (params.verifiedOwner) query = query.eq("is_verified", true);

  switch (params.sort) {
    case "rent_asc":
      query = query.order("rent", { ascending: true });
      break;
    case "rent_desc":
      query = query.order("rent", { ascending: false });
      break;
    case "rating":
      query = query.order("avg_rating", { ascending: false }).order("review_count", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) {
    console.error("searchProperties:", error.message);
    return { properties: [] as PropertyListItem[], total: 0, page, pageCount: 0 };
  }

  return {
    properties: (data ?? []) as unknown as PropertyListItem[],
    total: count ?? 0,
    page,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function getFeaturedProperties(limit = 6) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select(LIST_SELECT)
    .eq("status", "active")
    .order("is_verified", { ascending: false })
    .order("avg_rating", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as PropertyListItem[];
}

export async function getProperty(id: string): Promise<PropertyDetails | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select(
      `*, property_images(*),
       owner:users!properties_owner_id_fkey(id, full_name, avatar_url, is_verified, trust_score, role, created_at),
       property_amenities(amenity:amenities(id, slug, label, icon))`,
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as PropertyDetails) ?? null;
}

export async function getPropertyReviews(propertyId: string): Promise<ReviewWithReviewer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select(
      "*, reviewer:users!reviews_reviewer_id_fkey(id, full_name, avatar_url, is_verified, trust_score, role, created_at)",
    )
    .eq("property_id", propertyId)
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as unknown as ReviewWithReviewer[];
}

export async function getOwnerReviews(ownerId: string): Promise<ReviewWithReviewer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select(
      "*, reviewer:users!reviews_reviewer_id_fkey(id, full_name, avatar_url, is_verified, trust_score, role, created_at)",
    )
    .eq("reviewee_id", ownerId)
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as unknown as ReviewWithReviewer[];
}

export async function isPropertySaved(propertyId: string, userId: string | undefined) {
  if (!userId) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_properties")
    .select("property_id")
    .eq("tenant_id", userId)
    .eq("property_id", propertyId)
    .maybeSingle();
  return Boolean(data);
}

// ---------------------------------------------------------------------------
// Swipe-to-find
// ---------------------------------------------------------------------------

/** Every property this tenant has already swiped (either direction). */
export async function getSwipedPropertyIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("swipes")
    .select("property_id")
    .eq("tenant_id", userId);
  if (error) {
    // Table missing until migration 00005 runs — degrade to an unfiltered deck.
    console.error("getSwipedPropertyIds:", error.message);
    return [];
  }
  return (data ?? []).map((s) => s.property_id);
}

/** Right swipes left today on the free plan; null = unlimited (plus). */
export async function getSwipeQuota(user: UserRow | null): Promise<number | null> {
  if (!user) return FREE_DAILY_RIGHT_SWIPES; // anonymous — quota applies after login
  if (user.plan === "plus") return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("right_swipes_today");
  if (error) {
    console.error("getSwipeQuota:", error.message);
    return FREE_DAILY_RIGHT_SWIPES;
  }
  return Math.max(0, FREE_DAILY_RIGHT_SWIPES - (data ?? 0));
}

function sanitizeIlike(s: string) {
  return s.replace(/[%,()]/g, "").trim();
}

type DeckFilters = ParsedSearch & { relaxed?: boolean };

function buildDeckQuery(supabase: Awaited<ReturnType<typeof createClient>>, f: DeckFilters) {
  let query = supabase
    .from("properties")
    .select(LIST_SELECT)
    .eq("status", "active");

  if (f.bhk.length === 1) query = query.eq("bhk", f.bhk[0]);
  else if (f.bhk.length > 1) query = query.in("bhk", f.bhk);

  if (f.location) {
    const loc = sanitizeIlike(f.location);
    if (loc) query = query.or(`city.ilike.%${loc}%,locality.ilike.%${loc}%`);
  }
  if (f.minRent) query = query.gte("rent", f.minRent);
  if (f.maxRent) {
    // Relaxed pass stretches the ceiling 15% to surface close matches.
    query = query.lte("rent", f.relaxed ? Math.round(f.maxRent * 1.15) : f.maxRent);
  }
  if (f.petFriendly) query = query.eq("pet_friendly", true);
  if (!f.relaxed && f.furnished) query = query.eq("furnished_status", f.furnished);
  if (!f.relaxed && f.propertyType) query = query.eq("property_type", f.propertyType);
  if (f.occupancy) query = query.in("preferred_tenants", [f.occupancy, "any"]);
  if (f.verifiedOnly) query = query.eq("is_verified", true);

  return query
    .order("is_verified", { ascending: false })
    .order("avg_rating", { ascending: false })
    .order("created_at", { ascending: false });
}

/**
 * Builds the swipe deck: active listings matching the parsed requirements,
 * minus everything already swiped. If the strict pass returns a thin deck,
 * a relaxed pass (budget +15%, furnishing/type dropped) tops it up with
 * cards flagged close_match.
 */
export async function getSwipeDeck(
  parsed: ParsedSearch,
  excludeIds: string[],
): Promise<SwipeCardItem[]> {
  const supabase = await createClient();
  const excluded = new Set(excludeIds);

  let strictQuery = buildDeckQuery(supabase, parsed);
  if (excluded.size) strictQuery = strictQuery.not("id", "in", `(${[...excluded].join(",")})`);

  const { data: strict, error } = await strictQuery.limit(SWIPE_DECK_SIZE);
  if (error) {
    console.error("getSwipeDeck:", error.message);
    return [];
  }

  const cards = (strict ?? []) as unknown as SwipeCardItem[];
  if (cards.length >= 5) return cards;

  // Thin deck — top up with close matches (skip if nothing to relax).
  if (!parsed.maxRent && !parsed.furnished && !parsed.propertyType) return cards;

  for (const c of cards) excluded.add(c.id);
  let relaxedQuery = buildDeckQuery(supabase, { ...parsed, relaxed: true });
  if (excluded.size) relaxedQuery = relaxedQuery.not("id", "in", `(${[...excluded].join(",")})`);
  const { data: relaxedData } = await relaxedQuery.limit(SWIPE_DECK_SIZE - cards.length);

  const closeMatches = ((relaxedData ?? []) as unknown as SwipeCardItem[]).map((c) => ({
    ...c,
    close_match: true,
  }));
  return [...cards, ...closeMatches];
}

/** Shortlist demand per property for an owner's listings (id → count). */
export async function getShortlistCounts(propertyIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (!propertyIds.length) return counts;
  const supabase = await createClient();
  const results = await Promise.all(
    propertyIds.map((pid) => supabase.rpc("property_right_swipe_count", { pid })),
  );
  propertyIds.forEach((pid, i) => {
    counts[pid] = results[i].error ? 0 : (results[i].data ?? 0);
  });
  return counts;
}
