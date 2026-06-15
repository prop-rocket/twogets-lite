import type {
  PropertyImageRow,
  PropertyRow,
  ReviewRow,
  UserRow,
  VerificationRequestRow,
  ViewingBookingRow,
  ViewingBookingStatus,
  ViewingSlotWithCountsRow,
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

// ---------------------------------------------------------------------------
// Viewing slots & bookings (owner-published availability model)
// ---------------------------------------------------------------------------

/** A bookable slot plus the current tenant's own booking on it (if any). */
export type TenantSlot = ViewingSlotWithCountsRow & {
  my_booking: { id: string; status: ViewingBookingStatus } | null;
};

/** One attendee on an owner's slot. */
export type BookingAttendee = Pick<
  ViewingBookingRow,
  "id" | "status" | "party_size" | "note" | "tenant_id"
> & {
  tenant: PublicUser;
};

/** A slot from the owner's perspective: counts + who's coming. */
export type OwnerSlot = ViewingSlotWithCountsRow & {
  attendees: BookingAttendee[];
};

/** A tenant's booking joined to its slot and property (the "My viewings" list). */
export type TenantBooking = ViewingBookingRow & {
  slot: Pick<ViewingSlotWithCountsRow, "id" | "starts_at" | "ends_at" | "status" | "capacity">;
  property: Pick<PropertyRow, "id" | "title" | "locality" | "city">;
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
