import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatRent(amount: number) {
  return inr.format(amount);
}

export function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

// Viewing slots are stored as UTC timestamptz; TwoGets' market is IST, so we
// always present slot times in Asia/Kolkata regardless of the viewer's clock.
const IST = "Asia/Kolkata";

export function formatSlotDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: IST,
  });
}

export function formatSlotTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: IST,
  });
}

export function formatSlotRange(startIso: string, endIso: string) {
  return `${formatSlotTime(startIso)} – ${formatSlotTime(endIso)}`;
}

/** IST calendar day (YYYY-MM-DD) for grouping slots under day headers. */
export function istDayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });
}

/** Today's IST calendar day as YYYY-MM-DD (min bound for the tenant date picker). */
export function istTodayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: IST });
}

/** Human label for an IST day key (YYYY-MM-DD): "Mon, 16 Jun". */
export function formatDayKey(key: string) {
  // Anchor at IST noon so the calendar date never slips across the date line.
  return new Date(`${key}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: IST,
  });
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "U"
  );
}

export function publicMediaUrl(storagePath: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/property-media/${storagePath}`;
}

export function avatarUrl(pathOrUrl: string | null) {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${pathOrUrl}`;
}

export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
