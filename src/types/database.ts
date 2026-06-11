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
export type InquiryStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export type ReviewType = "owner_review" | "tenant_review";
export type ReportTarget = "user" | "property" | "review";
export type ReportStatus = "open" | "resolved" | "dismissed";

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

export type InquiryRow = {
  id: string;
  property_id: string;
  tenant_id: string;
  owner_id: string;
  message: string;
  preferred_date: string;
  preferred_time: string;
  status: InquiryStatus;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AppointmentRow = {
  id: string;
  inquiry_id: string;
  property_id: string;
  tenant_id: string;
  owner_id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: AppointmentStatus;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type ReviewRow = {
  id: string;
  review_type: ReviewType;
  appointment_id: string;
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
      inquiries: Omit<
        TableShape<InquiryRow, "property_id" | "tenant_id" | "owner_id" | "preferred_date" | "preferred_time">,
        "Relationships"
      > & {
        Relationships: [
          Rel<"inquiries_property_id_fkey", ["property_id"], "properties">,
          Rel<"inquiries_tenant_id_fkey", ["tenant_id"], "users">,
          Rel<"inquiries_owner_id_fkey", ["owner_id"], "users">,
        ];
      };
      appointments: Omit<
        TableShape<
          AppointmentRow,
          "inquiry_id" | "property_id" | "tenant_id" | "owner_id" | "scheduled_date" | "scheduled_time"
        >,
        "Relationships"
      > & {
        Relationships: [
          Rel<"appointments_inquiry_id_fkey", ["inquiry_id"], "inquiries", true>,
          Rel<"appointments_property_id_fkey", ["property_id"], "properties">,
          Rel<"appointments_tenant_id_fkey", ["tenant_id"], "users">,
          Rel<"appointments_owner_id_fkey", ["owner_id"], "users">,
        ];
      };
      reviews: Omit<
        TableShape<
          ReviewRow,
          "review_type" | "appointment_id" | "reviewer_id" | "reviewee_id" | "rating_communication" | "overall_rating"
        >,
        "Relationships"
      > & {
        Relationships: [
          Rel<"reviews_appointment_id_fkey", ["appointment_id"], "appointments">,
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
    };
    Views: Record<string, never>;
    Functions: {
      current_user_role: { Args: Record<PropertyKey, never>; Returns: UserRole | null };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      owns_property: { Args: { pid: string }; Returns: boolean };
      recalc_trust_score: { Args: { target: string }; Returns: undefined };
      increment_view_count: { Args: { pid: string }; Returns: undefined };
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
      inquiry_status: InquiryStatus;
      appointment_status: AppointmentStatus;
      review_type: ReviewType;
      report_target: ReportTarget;
      report_status: ReportStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
