import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  role: z.enum(["tenant", "homeowner"]),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const roleSelectionSchema = z.object({
  role: z.enum(["tenant", "homeowner"]),
});

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
const optionalUrl = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .max(300)
  .optional()
  .or(z.literal(""));

export const baseProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9\s-]{10,15}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
});

export const tenantProfileSchema = baseProfileSchema.extend({
  occupation: z.string().trim().max(80).optional().or(z.literal("")),
  employer: z.string().trim().max(120).optional().or(z.literal("")),
  incomeRange: z.enum(["below_3l", "3l_6l", "6l_12l", "12l_24l", "above_24l"]).optional(),
  occupancyType: z.enum(["bachelor", "family", "any"]),
  hasPets: z.boolean(),
  foodPreference: z.enum(["vegetarian", "non_vegetarian", "eggetarian", "no_preference"]),
  preferredLocations: z.array(z.string().trim().min(1).max(60)).max(10),
  budgetMin: z.coerce.number().int().min(0).max(10_000_000).optional(),
  budgetMax: z.coerce.number().int().min(0).max(10_000_000).optional(),
  moveInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date").optional().or(z.literal("")),
  linkedinUrl: optionalUrl,
  about: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const homeownerProfileSchema = baseProfileSchema.extend({
  about: z.string().trim().max(1000).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  linkedinUrl: optionalUrl,
});

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------
export const propertySchema = z.object({
  title: z.string().trim().min(5, "At least 5 characters").max(120),
  description: z.string().trim().max(5000),
  propertyType: z.enum(["apartment", "independent_house", "villa", "studio", "row_house", "penthouse"]),
  bhk: z.coerce.number().int().min(1).max(10),
  furnishedStatus: z.enum(["unfurnished", "semi_furnished", "fully_furnished"]),
  addressLine: z.string().trim().min(5, "Enter the address").max(240),
  locality: z.string().trim().min(2, "Enter the locality").max(80),
  city: z.string().trim().min(2, "Enter the city").max(60),
  state: z.string().trim().min(2, "Enter the state").max(60),
  pincode: z.string().trim().regex(/^\d{6}$/, "6-digit PIN code"),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  rent: z.coerce.number().int().min(1, "Enter the monthly rent").max(10_000_000),
  deposit: z.coerce.number().int().min(0).max(100_000_000),
  availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  petFriendly: z.boolean(),
  preferredTenants: z.enum(["bachelor", "family", "any"]),
  videoUrl: optionalUrl,
  amenityIds: z.array(z.coerce.number().int()).max(30),
  status: z.enum(["draft", "active", "archived", "rented"]).default("draft"),
});

// ---------------------------------------------------------------------------
// Viewing slots & bookings (owner-published availability)
// ---------------------------------------------------------------------------
const timeOfDay = z.string().regex(/^\d{2}:\d{2}$/, "Pick a time");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
// Optional split into sub-slots; null/absent => one open-house slot for the window.
const slotDuration = z.coerce.number().int().min(15).max(480).optional();
const capacity = z.coerce.number().int().min(1).max(500).optional();

export const oneOffSlotSchema = z
  .object({
    propertyId: z.string().uuid(),
    date: isoDate,
    startTime: timeOfDay,
    endTime: timeOfDay,
    slotDurationMin: slotDuration,
    capacity,
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const recurringRuleSchema = z
  .object({
    propertyId: z.string().uuid(),
    daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Pick at least one day"),
    startTime: timeOfDay,
    endTime: timeOfDay,
    slotDurationMin: slotDuration,
    capacity,
    validUntil: isoDate.optional().or(z.literal("")),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const bookSlotSchema = z.object({
  slotId: z.string().uuid(),
  partySize: z.coerce.number().int().min(1).max(10).default(1),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
const ratingValue = z.coerce.number().int().min(1).max(5);

export const reviewSchema = z.object({
  bookingId: z.string().uuid(),
  reviewType: z.enum(["owner_review", "tenant_review"]),
  ratingCommunication: ratingValue,
  ratingDepositFairness: ratingValue.optional(),
  ratingPropertyAccuracy: ratingValue.optional(),
  ratingReliability: ratingValue.optional(),
  ratingPropertyCare: ratingValue.optional(),
  comment: z.string().trim().max(2000),
});

// ---------------------------------------------------------------------------
// Verification & reports
// ---------------------------------------------------------------------------
export const verificationSubmitSchema = z.object({
  documentType: z.enum(["aadhaar", "pan", "utility_bill", "property_tax_receipt", "sale_deed"]),
  storagePath: z.string().min(3).max(500),
  propertyId: z.string().uuid().optional(),
});

export const verificationReviewSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().trim().max(500).optional(),
});

export const reportSchema = z.object({
  targetType: z.enum(["user", "property", "review"]),
  targetId: z.string().uuid(),
  reason: z.string().trim().min(3, "Tell us what's wrong").max(120),
  details: z.string().trim().max(2000),
});
