import type {
  AppointmentRow,
  InquiryRow,
  PropertyImageRow,
  PropertyRow,
  ReviewRow,
  UserRow,
  VerificationRequestRow,
} from "./database";

export * from "./database";

/** Public-safe slice of a user shown on cards and reviews. */
export type PublicUser = Pick<
  UserRow,
  "id" | "full_name" | "avatar_url" | "is_verified" | "trust_score" | "role" | "created_at"
>;

export type PropertyWithImages = PropertyRow & {
  property_images: PropertyImageRow[];
};

export type PropertyListItem = PropertyWithImages & {
  owner: PublicUser;
};

/** Card in the swipe deck. close_match = surfaced by relaxed filters. */
export type SwipeCardItem = PropertyListItem & {
  close_match?: boolean;
};

export type PropertyDetails = PropertyWithImages & {
  owner: PublicUser;
  property_amenities: { amenity: { id: number; slug: string; label: string; icon: string } }[];
};

export type InquiryWithRelations = InquiryRow & {
  property: Pick<PropertyRow, "id" | "title" | "locality" | "city" | "rent">;
  tenant: PublicUser;
  owner: PublicUser;
};

export type AppointmentWithRelations = AppointmentRow & {
  property: Pick<PropertyRow, "id" | "title" | "locality" | "city">;
  tenant: PublicUser;
  owner: PublicUser;
};

export type ReviewWithReviewer = ReviewRow & {
  reviewer: PublicUser;
};

export type VerificationWithUser = VerificationRequestRow & {
  user: PublicUser & { email?: string };
  property: Pick<PropertyRow, "id" | "title"> | null;
};

/** Standard envelope returned by all server actions. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | {
      ok: false;
      error: string;
      /** Machine-readable reason for errors the UI branches on (e.g. "quota"). */
      code?: string;
      fieldErrors?: Record<string, string[]>;
    };
