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
