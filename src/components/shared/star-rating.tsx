import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function StarRating({
  rating,
  count,
  className,
}: {
  rating: number;
  count?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="flex">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn(
              "size-4",
              i < Math.round(rating) ? "fill-accent text-accent" : "fill-muted text-muted",
            )}
          />
        ))}
      </span>
      <span className="text-sm font-medium">{rating > 0 ? rating.toFixed(1) : "New"}</span>
      {count != null && count > 0 && (
        <span className="text-sm text-muted-foreground">({count})</span>
      )}
    </span>
  );
}
