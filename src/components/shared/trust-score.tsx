import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Letting and renting are separate reputations — a great landlord isn't
 * necessarily a great tenant — so the label says which one is being shown.
 * Defaults to the pooled score so existing call sites keep their meaning.
 */
const LABELS = {
  overall: { suffix: "/100 trust", title: "TwoGets Trust Score (0–100): verification + community reviews" },
  letting: { suffix: "/100 as host", title: "Reputation as a host (0–100): verification + reviews from renters" },
  renting: { suffix: "/100 as renter", title: "Reputation as a renter (0–100): verification + reviews from hosts" },
} as const;

export function TrustScore({
  score,
  variant = "overall",
  className,
}: {
  score: number;
  variant?: keyof typeof LABELS;
  className?: string;
}) {
  const tone =
    score >= 75 ? "text-emerald-600" : score >= 45 ? "text-amber-600" : "text-muted-foreground";
  const { suffix, title } = LABELS[variant];
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-sm font-semibold", tone, className)}
      title={title}
    >
      <ShieldCheck className="size-4" />
      {Math.round(score)}
      <span className="font-normal text-muted-foreground">{suffix}</span>
    </span>
  );
}
