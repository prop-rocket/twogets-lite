import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export function TrustScore({ score, className }: { score: number; className?: string }) {
  const tone =
    score >= 75 ? "text-emerald-600" : score >= 45 ? "text-amber-600" : "text-muted-foreground";
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-sm font-semibold", tone, className)}
      title="TwoGets Trust Score (0–100): verification + community reviews"
    >
      <ShieldCheck className="size-4" />
      {Math.round(score)}
      <span className="font-normal text-muted-foreground">/100 trust</span>
    </span>
  );
}
