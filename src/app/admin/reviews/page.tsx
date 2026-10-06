import { Star } from "lucide-react";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { ExportButton, ModerateReviewButton } from "@/components/admin/admin-actions";
import { ReviewCard } from "@/components/review/review-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { listAdminReviews } from "@/server/admin-queries";

export const metadata = { title: "Moderate Reviews" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

const FILTERS = [
  {
    type: "select" as const,
    key: "visibility",
    label: "Visibility",
    options: [
      { value: "hidden", label: "Hidden only" },
      { value: "visible", label: "Visible only" },
    ],
  },
  {
    type: "select" as const,
    key: "maxRating",
    label: "Rating",
    options: [
      { value: "2", label: "2 stars and below" },
      { value: "3", label: "3 stars and below" },
    ],
  },
];

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const visibility = str(params.visibility);
  const maxRating = Number(str(params.maxRating));

  const { rows, total, page, pageCount } = await listAdminReviews({
    approved: visibility === "hidden" ? false : visibility === "visible" ? true : undefined,
    minRating: Number.isFinite(maxRating) && maxRating > 0 ? maxRating : undefined,
    page: Number(str(params.page) ?? 1),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Reviews</h1>
          <p className="text-muted-foreground">
            Hide abusive or fake reviews — hidden reviews stop counting toward ratings and trust
            scores. {total} {total === 1 ? "review" : "reviews"} match these filters.
          </p>
        </div>
        <ExportButton dataset="reviews" />
      </div>

      <AdminFilterBar fields={FILTERS} />

      {rows.length === 0 ? (
        <EmptyState icon={Star} title="No reviews match these filters" />
      ) : (
        <div className="space-y-4">
          {rows.map((review) => (
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

      <Pagination
        page={page}
        pageCount={pageCount}
        searchParams={params}
        basePath="/admin/reviews"
      />
    </div>
  );
}
