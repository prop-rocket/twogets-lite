import "server-only";

import { PAGE_SIZE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type {
  PropertyRow,
  PropertyStatus,
  ReportRow,
  ReportStatus,
  ReportTarget,
  ReviewWithReviewer,
  UserPlan,
  UserRole,
  UserRow,
  VerificationWithUser,
  DocumentType,
} from "@/types";

/** One page of admin rows, shaped for the shared <Pagination /> component. */
export interface AdminPage<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
}

function bounds(page?: number) {
  const current = Math.max(1, Math.floor(page ?? 1) || 1);
  const from = (current - 1) * PAGE_SIZE;
  return { current, from, to: from + PAGE_SIZE - 1 };
}

function toPage<T>(rows: T[] | null, count: number | null, current: number): AdminPage<T> {
  const total = count ?? 0;
  return { rows: rows ?? [], total, page: current, pageCount: Math.ceil(total / PAGE_SIZE) };
}

/**
 * PostgREST parses `,` `(` `)` as filter syntax inside .or(), so a raw search
 * term containing them would produce a malformed query rather than no match.
 */
function searchTerm(q?: string) {
  const cleaned = q?.trim().replace(/[,()*]/g, "");
  return cleaned ? cleaned : undefined;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export interface AdminUserFilters {
  q?: string;
  role?: UserRole;
  plan?: UserPlan;
  verified?: boolean;
  banned?: boolean;
  page?: number;
}

export async function listAdminUsers(filters: AdminUserFilters = {}): Promise<AdminPage<UserRow>> {
  const supabase = await createClient();
  const { current, from, to } = bounds(filters.page);

  let query = supabase.from("users").select("*", { count: "exact" });

  const q = searchTerm(filters.q);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  if (filters.role) query = query.eq("role", filters.role);
  if (filters.plan) query = query.eq("plan", filters.plan);
  if (filters.verified !== undefined) query = query.eq("is_verified", filters.verified);
  if (filters.banned !== undefined) query = query.eq("is_banned", filters.banned);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) {
    console.error("listAdminUsers:", error.message);
    return toPage<UserRow>([], 0, current);
  }
  return toPage(data as UserRow[], count, current);
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------
export type AdminListing = PropertyRow & {
  owner: { full_name: string; email: string } | null;
};

export interface AdminListingFilters {
  q?: string;
  city?: string;
  status?: PropertyStatus;
  verified?: boolean;
  page?: number;
}

export async function listAdminListings(
  filters: AdminListingFilters = {},
): Promise<AdminPage<AdminListing>> {
  const supabase = await createClient();
  const { current, from, to } = bounds(filters.page);

  let query = supabase
    .from("properties")
    .select("*, owner:users!properties_owner_id_fkey(full_name, email)", { count: "exact" });

  const q = searchTerm(filters.q);
  if (q) query = query.or(`title.ilike.%${q}%,locality.ilike.%${q}%,city.ilike.%${q}%`);
  if (filters.city) query = query.eq("city", filters.city);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.verified !== undefined) query = query.eq("is_verified", filters.verified);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) {
    console.error("listAdminListings:", error.message);
    return toPage<AdminListing>([], 0, current);
  }
  return toPage(data as unknown as AdminListing[], count, current);
}

/** Distinct cities across all listings, for the listings filter dropdown. */
export async function listingCities(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("properties").select("city");
  if (error) return [];
  return [...new Set((data ?? []).map((r) => r.city))].sort();
}

// ---------------------------------------------------------------------------
// Verification queue
//
// Pending and reviewed are queried separately so a large backlog can never
// crowd the reviewed history out of the page (the previous single capped query
// shared one limit between both).
// ---------------------------------------------------------------------------
const VERIFICATION_SELECT = `*,
   user:users!verification_requests_user_id_fkey(id, full_name, email, avatar_url, is_verified, trust_score, role, created_at),
   property:properties(id, title)`;

export interface AdminVerificationFilters {
  scope: "pending" | "reviewed";
  documentType?: DocumentType;
  page?: number;
}

export async function listVerifications(
  filters: AdminVerificationFilters,
): Promise<AdminPage<VerificationWithUser>> {
  const supabase = await createClient();
  const { current, from, to } = bounds(filters.page);

  let query = supabase
    .from("verification_requests")
    .select(VERIFICATION_SELECT, { count: "exact" });

  query =
    filters.scope === "pending"
      ? query.eq("status", "pending")
      : query.neq("status", "pending");
  if (filters.documentType) query = query.eq("document_type", filters.documentType);

  // Pending is a queue: oldest first. Reviewed is history: newest first.
  const { data, count, error } = await query
    .order("created_at", { ascending: filters.scope === "pending" })
    .range(from, to);
  if (error) {
    console.error("listVerifications:", error.message);
    return toPage<VerificationWithUser>([], 0, current);
  }
  return toPage(data as unknown as VerificationWithUser[], count, current);
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export type AdminReview = ReviewWithReviewer & { is_approved: boolean };

export interface AdminReviewFilters {
  approved?: boolean;
  minRating?: number;
  page?: number;
}

export async function listAdminReviews(
  filters: AdminReviewFilters = {},
): Promise<AdminPage<AdminReview>> {
  const supabase = await createClient();
  const { current, from, to } = bounds(filters.page);

  let query = supabase
    .from("reviews")
    .select(
      "*, reviewer:users!reviews_reviewer_id_fkey(id, full_name, avatar_url, is_verified, trust_score, role, created_at)",
      { count: "exact" },
    );

  if (filters.approved !== undefined) query = query.eq("is_approved", filters.approved);
  if (filters.minRating !== undefined) query = query.lte("overall_rating", filters.minRating);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) {
    console.error("listAdminReviews:", error.message);
    return toPage<AdminReview>([], 0, current);
  }
  return toPage(data as unknown as AdminReview[], count, current);
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export type AdminReport = ReportRow & {
  reporter: { full_name: string; email: string } | null;
};

export interface AdminReportFilters {
  status?: ReportStatus;
  targetType?: ReportTarget;
  page?: number;
}

export async function listReports(
  filters: AdminReportFilters = {},
): Promise<AdminPage<AdminReport>> {
  const supabase = await createClient();
  const { current, from, to } = bounds(filters.page);

  let query = supabase
    .from("reports")
    .select("*, reporter:users!reports_reporter_id_fkey(full_name, email)", { count: "exact" });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.targetType) query = query.eq("target_type", filters.targetType);

  const { data, count, error } = await query
    .order("status", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) {
    console.error("listReports:", error.message);
    return toPage<AdminReport>([], 0, current);
  }
  return toPage(data as unknown as AdminReport[], count, current);
}
