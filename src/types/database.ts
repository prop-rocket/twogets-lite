/**
 * Hand-maintained database types mirroring supabase/migrations.
 * Regenerate with `supabase gen types typescript --linked` once the project is linked.
 *
 * NOTE: rows must be `type` aliases (not interfaces) — interfaces lack the
 * implicit index signature supabase-js's `Record<string, unknown>` constraint needs.
 */

export type UserRole = "tenant" | "homeowner" | "admin";
export type VerificationStatus = "pending" | "approved" | "rejected";
export type DocumentType = "aadhaar" | "pan" | "utility_bill" | "property_tax_receipt" | "sale_deed";
export type PropertyType = "apartment" | "independent_house" | "villa" | "studio" | "row_house" | "penthouse";
export type FurnishedStatus = "unfurnished" | "semi_furnished" | "fully_furnished";
export type OccupancyPreference = "bachelor" | "family" | "any";
export type FoodPreference = "vegetarian" | "non_vegetarian" | "eggetarian" | "no_preference";
export type IncomeRange = "below_3l" | "3l_6l" | "6l_12l" | "12l_24l" | "above_24l";
export type PropertyStatus = "draft" | "active" | "archived" | "rented";
export type ViewingSlotSource = "manual" | "recurring";
export type ViewingSlotStatus = "open" | "cancelled";
export type ViewingBookingStatus = "confirmed" | "cancelled" | "attended" | "no_show";
export type ReviewType = "owner_review" | "tenant_review";
export type ReportTarget = "user" | "property" | "review";
export type ReportStatus = "open" | "resolved" | "dismissed";
export type SwipeDirection = "left" | "right";
export type UserPlan = "free" | "plus";

export type UserRow = {
  id: string;
  role: UserRole | null;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  trust_score: number;
  is_banned: boolean;
  plan: UserPlan;
  created_at: string;
  updated_at: string;
};

export type TenantProfileRow = {
  user_id: string;
  occupation: string | null;
  employer: string | null;
  income_range: IncomeRange | null;
  occupancy_type: OccupancyPreference;
  has_pets: boolean;
  food_preference: FoodPreference;
  preferred_locations: string[];
  budget_min: number | null;
  budget_max: number | null;
  move_in_date: string | null;
  linkedin_url: string | null;
  about: string | null;
  created_at: string;
  updated_at: string;
};

export type HomeownerProfileRow = {
  user_id: string;
  about: string | null;
  city: string | null;
  linkedin_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PropertyRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  property_type: PropertyType;
  bhk: number;
  furnished_status: FurnishedStatus;
  address_line: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  rent: number;
  deposit: number;
  available_from: string;
  pet_friendly: boolean;
  preferred_tenants: OccupancyPreference;
  video_url: string | null;
  status: PropertyStatus;
  is_verified: boolean;
  view_count: number;
  avg_rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
};

export type PropertyImageRow = {
  id: string;
  property_id: string;
  storage_path: string;
  alt_text: string;
  sort_order: number;
  is_cover: boolean;
  created_at: string;
};

export type AmenityRow = {
  id: number;
  slug: string;
  label: string;
  icon: string;
};

export type PropertyAmenityRow = {
  property_id: string;
  amenity_id: number;
};

export type VerificationRequestRow = {
  id: string;
  user_id: string;
  property_id: string | null;
  document_type: DocumentType;
  storage_path: string;
  status: VerificationStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SavedPropertyRow = {
  tenant_id: string;
  property_id: string;
  created_at: string;
};

export type ViewingAvailabilityRuleRow = {
  id: string;
  listing_id: string;
  owner_id: string;
  day_of_week: number; // 0 = Sunday … 6 = Saturday
  start_time: string; // HH:MM[:SS]
  end_time: string;
  slot_duration_min: number | null; // null => whole window is one open-house slot
  capacity: number | null; // null => unlimited
  valid_from: string;
  valid_until: string | null;
  timezone: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ViewingSlotRow = {
  id: string;
  listing_id: string;
  owner_id: string;
  rule_id: string | null;
  starts_at: string; // UTC timestamptz
  ends_at: string;
  capacity: number | null;
  status: ViewingSlotStatus;
  source: ViewingSlotSource;
  created_at: string;
  updated_at: string;
};

/** Read model: viewing_slots + live booking counts (viewing_slots_with_counts). */
export type ViewingSlotWithCountsRow = ViewingSlotRow & {
  going_count: number;
  spots_left: number | null; // null => unlimited capacity
  is_full: boolean;
};

export type ViewingBookingRow = {
  id: string;
  slot_id: string;
  listing_id: string;
  tenant_id: string;
  status: ViewingBookingStatus;
  party_size: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewRow = {
  id: string;
  review_type: ReviewType;
  booking_id: string | null;
  property_id: string | null;
  reviewer_id: string;
  reviewee_id: string;
  rating_communication: number;
  rating_deposit_fairness: number | null;
  rating_property_accuracy: number | null;
  rating_reliability: number | null;
  rating_property_care: number | null;
  overall_rating: number;
  comment: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
};

export type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: string;
  details: string;
  status: ReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type SwipeRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  direction: SwipeDirection;
  swiped_at: string;
  created_at: string;
};

/** jsonb envelope returned by the record_swipe() database function. */
export type RecordSwipeResult = {
  ok: boolean;
  code?: "auth" | "role" | "banned" | "gone" | "quota";
  right_today?: number;
  /** null = unlimited (plus plan) */
  remaining?: number | null;
};

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type TableShape<Row extends Record<string, unknown>, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: Relationship[];
};

type Rel<
  FK extends string,
  Cols extends string[],
  Ref extends string,
  OneToOne extends boolean = false,
> = {
  foreignKeyName: FK;
  columns: Cols;
  isOneToOne: OneToOne;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      users: Omit<TableShape<UserRow, "id" | "email">, "Relationships"> & { Relationships: [] };
      tenant_profiles: Omit<TableShape<TenantProfileRow, "user_id">, "Relationships"> & {
        Relationships: [Rel<"tenant_profiles_user_id_fkey", ["user_id"], "users", true>];
      };
      homeowner_profiles: Omit<TableShape<HomeownerProfileRow, "user_id">, "Relationships"> & {
        Relationships: [Rel<"homeowner_profiles_user_id_fkey", ["user_id"], "users", true>];
      };
      properties: Omit<
        TableShape<
          PropertyRow,
          | "owner_id" | "title" | "property_type" | "bhk"
          | "address_line" | "locality" | "city" | "state" | "pincode" | "rent"
        >,
        "Relationships"
      > & {
        Relationships: [Rel<"properties_owner_id_fkey", ["owner_id"], "users">];
      };
      property_images: Omit<TableShape<PropertyImageRow, "property_id" | "storage_path">, "Relationships"> & {
        Relationships: [Rel<"property_images_property_id_fkey", ["property_id"], "properties">];
      };
      amenities: Omit<TableShape<AmenityRow, "slug" | "label">, "Relationships"> & { Relationships: [] };
      property_amenities: Omit<TableShape<PropertyAmenityRow, "property_id" | "amenity_id">, "Relationships"> & {
        Relationships: [
          Rel<"property_amenities_property_id_fkey", ["property_id"], "properties">,
          Rel<"property_amenities_amenity_id_fkey", ["amenity_id"], "amenities">,
        ];
      };
      verification_requests: Omit<
        TableShape<VerificationRequestRow, "user_id" | "document_type" | "storage_path">,
        "Relationships"
      > & {
        Relationships: [
          Rel<"verification_requests_user_id_fkey", ["user_id"], "users">,
          Rel<"verification_requests_property_id_fkey", ["property_id"], "properties">,
          Rel<"verification_requests_reviewed_by_fkey", ["reviewed_by"], "users">,
        ];
      };
      saved_properties: Omit<TableShape<SavedPropertyRow, "tenant_id" | "property_id">, "Relationships"> & {
        Relationships: [
          Rel<"saved_properties_tenant_id_fkey", ["tenant_id"], "users">,
          Rel<"saved_properties_property_id_fkey", ["property_id"], "properties">,
        ];
      };
      viewing_availability_rules: Omit<
        TableShape<ViewingAvailabilityRuleRow, "listing_id" | "owner_id" | "day_of_week" | "start_time" | "end_time">,
        "Relationships"
      > & {
        Relationships: [
          Rel<"viewing_availability_rules_listing_id_fkey", ["listing_id"], "properties">,
          Rel<"viewing_availability_rules_owner_id_fkey", ["owner_id"], "users">,
        ];
      };
      viewing_slots: Omit<
        TableShape<ViewingSlotRow, "listing_id" | "owner_id" | "starts_at" | "ends_at" | "source">,
        "Relationships"
      > & {
        Relationships: [
          Rel<"viewing_slots_listing_id_fkey", ["listing_id"], "properties">,
          Rel<"viewing_slots_owner_id_fkey", ["owner_id"], "users">,
          Rel<"viewing_slots_rule_id_fkey", ["rule_id"], "viewing_availability_rules">,
        ];
      };
      viewing_bookings: Omit<
        TableShape<ViewingBookingRow, "slot_id" | "listing_id" | "tenant_id">,
        "Relationships"
      > & {
        Relationships: [
          Rel<"viewing_bookings_slot_id_fkey", ["slot_id"], "viewing_slots">,
          Rel<"viewing_bookings_listing_id_fkey", ["listing_id"], "properties">,
          Rel<"viewing_bookings_tenant_id_fkey", ["tenant_id"], "users">,
        ];
      };
      reviews: Omit<
        TableShape<
          ReviewRow,
          "review_type" | "reviewer_id" | "reviewee_id" | "rating_communication" | "overall_rating"
        >,
        "Relationships"
      > & {
        Relationships: [
          Rel<"reviews_booking_id_fkey", ["booking_id"], "viewing_bookings">,
          Rel<"reviews_property_id_fkey", ["property_id"], "properties">,
          Rel<"reviews_reviewer_id_fkey", ["reviewer_id"], "users">,
          Rel<"reviews_reviewee_id_fkey", ["reviewee_id"], "users">,
        ];
      };
      reports: Omit<TableShape<ReportRow, "reporter_id" | "target_type" | "target_id" | "reason">, "Relationships"> & {
        Relationships: [
          Rel<"reports_reporter_id_fkey", ["reporter_id"], "users">,
          Rel<"reports_resolved_by_fkey", ["resolved_by"], "users">,
        ];
      };
      audit_logs: Omit<TableShape<AuditLogRow, "action" | "entity_type" | "entity_id">, "Relationships"> & {
        Relationships: [Rel<"audit_logs_actor_id_fkey", ["actor_id"], "users">];
      };
      swipes: Omit<TableShape<SwipeRow, "tenant_id" | "property_id" | "direction">, "Relationships"> & {
        Relationships: [
          Rel<"swipes_tenant_id_fkey", ["tenant_id"], "users">,
          Rel<"swipes_property_id_fkey", ["property_id"], "properties">,
        ];
      };
    };
    Views: {
      viewing_slots_with_counts: {
        Row: ViewingSlotWithCountsRow;
        Relationships: [];
      };
    };
    Functions: {
      current_user_role: { Args: Record<PropertyKey, never>; Returns: UserRole | null };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      owns_property: { Args: { pid: string }; Returns: boolean };
      recalc_trust_score: { Args: { target: string }; Returns: undefined };
      increment_view_count: { Args: { pid: string }; Returns: undefined };
      right_swipes_today: { Args: Record<PropertyKey, never>; Returns: number };
      record_swipe: {
        Args: { p_property_id: string; p_direction: SwipeDirection };
        Returns: RecordSwipeResult;
      };
      property_right_swipe_count: { Args: { pid: string }; Returns: number };
      generate_slots_for_rule: { Args: { p_rule_id: string; p_horizon_days?: number }; Returns: number };
      book_viewing_slot: {
        Args: { p_slot_id: string; p_party_size?: number; p_note?: string | null };
        Returns: ViewingBookingRow;
      };
      cancel_viewing_slot: { Args: { p_slot_id: string }; Returns: undefined };
      set_booking_attendance: {
        Args: { p_booking_id: string; p_status: ViewingBookingStatus };
        Returns: undefined;
      };
      viewing_slot_going_count: { Args: { p_slot_id: string }; Returns: number };
    };
    Enums: {
      user_role: UserRole;
      verification_status: VerificationStatus;
      document_type: DocumentType;
      property_type: PropertyType;
      furnished_status: FurnishedStatus;
      occupancy_preference: OccupancyPreference;
      food_preference: FoodPreference;
      income_range: IncomeRange;
      property_status: PropertyStatus;
      viewing_slot_source: ViewingSlotSource;
      viewing_slot_status: ViewingSlotStatus;
      viewing_booking_status: ViewingBookingStatus;
      review_type: ReviewType;
      report_target: ReportTarget;
      report_status: ReportStatus;
      swipe_direction: SwipeDirection;
      user_plan: UserPlan;
    };
    CompositeTypes: Record<string, never>;
  };
};
