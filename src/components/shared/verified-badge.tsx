import { BadgeCheck, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function VerifiedBadge({
  kind = "user",
  className,
}: {
  kind?: "user" | "property" | "owner" | "tenant";
  className?: string;
}) {
  const label =
    kind === "property"
      ? "Verified Property"
      : kind === "owner"
        ? "Verified Owner"
        : kind === "tenant"
          ? "Verified Tenant"
          : "Verified";
  const Icon = kind === "property" ? ShieldCheck : BadgeCheck;
  return (
    <Badge variant="verified" className={cn("gap-1", className)}>
      <Icon className="size-3.5" />
      {label}
    </Badge>
  );
}
