import { Star } from "lucide-react";

import { ModerateReviewButton } from "@/components/admin/admin-actions";
import { ReviewCard } from "@/components/review/review-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import type { ReviewWithReviewer } from "@/types";

export const metadata = { title: "Moderate Reviews" };

export default async function AdminReviewsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select(
      "*, reviewer:users!reviews_reviewer_id_fkey(id, full_name, avatar_url, is_verified, trust_score, role, created_at)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const reviews = (data ?? []) as unknown as (ReviewWithReviewer & { is_approved: boolean })[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Reviews</h1>
        <p className="text-muted-foreground">
          Hide abusive or fake reviews — hidden reviews stop counting toward ratings and trust
          scores.
        </p>
      </div>

      {reviews.length === 0 ? (
        <EmptyState icon={Star} title="No reviews yet" />
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="space-y-2">
              <ReviewCard review={review} />
              <div className="flex items-center gap-2 pl-1">
                {!review.is_approved && <Badge variant="destructive">Hidden</Badge>}
                <ModerateReviewButton reviewId={review.id} isApproved={review.is_approved} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
