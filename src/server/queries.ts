import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, type SortOption } from "@/lib/constants";
import type { PropertyDetails, PropertyListItem, ReviewWithReviewer } from "@/types";

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
