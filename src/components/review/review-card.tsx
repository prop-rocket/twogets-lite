import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/shared/star-rating";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { avatarUrl, formatDate, initials } from "@/lib/utils";
import type { ReviewWithReviewer } from "@/types";

const DIMENSION_LABELS: [keyof ReviewWithReviewer, string][] = [
  ["rating_communication", "Communication"],
  ["rating_deposit_fairness", "Deposit fairness"],
  ["rating_property_accuracy", "Property accuracy"],
  ["rating_reliability", "Reliability"],
  ["rating_property_care", "Property care"],
];

export function ReviewCard({ review }: { review: ReviewWithReviewer }) {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage
              src={avatarUrl(review.reviewer.avatar_url) ?? undefined}
              alt={review.reviewer.full_name}
            />
            <AvatarFallback>{initials(review.reviewer.full_name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              {review.reviewer.full_name}
              {review.reviewer.is_verified && <VerifiedBadge />}
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(review.created_at)}</p>
          </div>
        </div>
        <StarRating rating={Number(review.overall_rating)} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {DIMENSION_LABELS.map(([key, label]) => {
          const value = review[key];
          if (value == null) return null;
          return (
            <span key={key}>
              {label}: <span className="font-semibold text-foreground">{String(value)}/5</span>
            </span>
          );
        })}
      </div>

      {review.comment && <p className="text-sm leading-relaxed">{review.comment}</p>}
    </div>
  );
}
