import { redirect } from "next/navigation";
import { Star } from "lucide-react";

import { ReviewCard } from "@/components/review/review-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { ReviewWithReviewer } from "@/types";

export const metadata = { title: "Reviews" };

const REVIEWER_SELECT =
  "*, reviewer:users!reviews_reviewer_id_fkey(id, full_name, avatar_url, is_verified, trust_score, role, created_at)";

export default async function ReviewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [{ data: aboutMe }, { data: byMe }] = await Promise.all([
    supabase
      .from("reviews")
      .select(REVIEWER_SELECT)
      .eq("reviewee_id", user.id)
      .eq("is_approved", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select(REVIEWER_SELECT)
      .eq("reviewer_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const received = (aboutMe ?? []) as unknown as ReviewWithReviewer[];
  const written = (byMe ?? []) as unknown as ReviewWithReviewer[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Reviews</h1>
        <p className="text-muted-foreground">
          Reviews you&apos;ve received feed your trust score; reviews you write help the community.
        </p>
      </div>

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">About you ({received.length})</TabsTrigger>
          <TabsTrigger value="written">By you ({written.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="received" className="space-y-4">
          {received.length === 0 ? (
            <EmptyState
              icon={Star}
              title="No reviews yet"
              description="Complete a viewing and the other side can review you."
            />
          ) : (
            received.map((review) => <ReviewCard key={review.id} review={review} />)
          )}
        </TabsContent>
        <TabsContent value="written" className="space-y-4">
          {written.length === 0 ? (
            <EmptyState
              icon={Star}
              title="You haven't written any reviews"
              description="After a completed viewing, share your experience."
            />
          ) : (
            written.map((review) => <ReviewCard key={review.id} review={review} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
