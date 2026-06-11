import type {
  AppointmentStatus,
  DocumentType,
  FoodPreference,
  FurnishedStatus,
  IncomeRange,
  InquiryStatus,
  OccupancyPreference,
  PropertyStatus,
  PropertyType,
  VerificationStatus,
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

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  pending: "Awaiting Response",
  accepted: "Accepted",
  rejected: "Declined",
  cancelled: "Cancelled",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "rent_asc", label: "Rent: low to high" },
  { value: "rent_desc", label: "Rent: high to low" },
  { value: "rating", label: "Top rated" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const PAGE_SIZE = 12;

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
