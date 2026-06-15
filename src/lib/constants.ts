import type {
  DocumentType,
  FoodPreference,
  FurnishedStatus,
  IncomeRange,
  OccupancyPreference,
  PropertyStatus,
  PropertyType,
  UserPlan,
  VerificationStatus,
  ViewingBookingStatus,
} from "@/types";

export const APP_NAME = "TwoGets";
export const APP_TAGLINE = "Home rental made instant — get your place, get moving.";

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Apartment",
  independent_house: "Independent House",
  villa: "Villa",
  studio: "Studio",
  row_house: "Row House",
  penthouse: "Penthouse",
};

export const FURNISHED_LABELS: Record<FurnishedStatus, string> = {
  unfurnished: "Unfurnished",
  semi_furnished: "Semi-furnished",
  fully_furnished: "Fully furnished",
};

export const OCCUPANCY_LABELS: Record<OccupancyPreference, string> = {
  bachelor: "Bachelor",
  family: "Family",
  any: "Bachelor / Family",
};

export const FOOD_LABELS: Record<FoodPreference, string> = {
  vegetarian: "Vegetarian",
  non_vegetarian: "Non-vegetarian",
  eggetarian: "Eggetarian",
  no_preference: "No preference",
};

export const INCOME_LABELS: Record<IncomeRange, string> = {
  below_3l: "Below ₹3L / yr",
  "3l_6l": "₹3L – ₹6L / yr",
  "6l_12l": "₹6L – ₹12L / yr",
  "12l_24l": "₹12L – ₹24L / yr",
  above_24l: "Above ₹24L / yr",
};

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  utility_bill: "Utility Bill",
  property_tax_receipt: "Property Tax Receipt",
  sale_deed: "Sale Deed",
};

export const IDENTITY_DOCUMENTS: DocumentType[] = ["aadhaar", "pan"];
export const OWNERSHIP_DOCUMENTS: DocumentType[] = ["utility_bill", "property_tax_receipt", "sale_deed"];

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: "Draft",
  active: "Live",
  archived: "Archived",
  rented: "Rented Out",
};

export const VIEWING_BOOKING_STATUS_LABELS: Record<ViewingBookingStatus, string> = {
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  attended: "Attended",
  no_show: "No-show",
};

// Sun-first to match day_of_week (0 = Sunday) used by recurring rules.
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAY_LABELS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// Optional split of an availability window into back-to-back sub-slots.
export const SLOT_DURATION_OPTIONS = [
  { value: "", label: "One open-house slot (no split)" },
  { value: "30", label: "30-minute slots" },
  { value: "45", label: "45-minute slots" },
  { value: "60", label: "60-minute slots" },
] as const;

/** Rolling horizon (days) recurring rules materialize slots across. */
export const VIEWING_HORIZON_DAYS = 28;

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "rent_asc", label: "Rent: low to high" },
  { value: "rent_desc", label: "Rent: high to low" },
  { value: "rating", label: "Top rated" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const PAGE_SIZE = 12;

// Swipe-to-find
export const FREE_DAILY_RIGHT_SWIPES = 3;
export const VIEWING_PROMPT_EVERY = 3;
export const SWIPE_DECK_SIZE = 30;

export const PLAN_LABELS: Record<UserPlan, string> = {
  free: "Free",
  plus: "Plus",
};

export const POPULAR_CITIES = [
  "Bengaluru",
  "Mumbai",
  "Delhi",
  "Hyderabad",
  "Chennai",
  "Pune",
  "Kolkata",
  "Gurugram",
] as const;
