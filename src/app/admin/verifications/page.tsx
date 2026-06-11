import { FileCheck2 } from "lucide-react";

import {
  VerificationReviewActions,
  ViewDocumentButton,
} from "@/components/admin/admin-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DOCUMENT_LABELS, VERIFICATION_STATUS_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { VerificationWithUser } from "@/types";

export const metadata = { title: "Verification Queue" };

export default async function AdminVerificationsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("verification_requests")
    .select(
      `*,
       user:users!verification_requests_user_id_fkey(id, full_name, email, avatar_url, is_verified, trust_score, role, created_at),
       property:properties(id, title)`,
    )
    .order("status", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(100);

  const requests = (data ?? []) as unknown as VerificationWithUser[];
  const pending = requests.filter((r) => r.status === "pending");
  const reviewed = requests.filter((r) => r.status !== "pending");

  function RequestCard({ request }: { request: VerificationWithUser }) {
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">
                {DOCUMENT_LABELS[request.document_type]}
                {request.property && (
                  <span className="text-muted-foreground"> · {request.property.title}</span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {request.user.full_name} ({request.user.email}) · {request.user.role} · submitted{" "}
                {formatDate(request.created_at)}
              </p>
            </div>
            <Badge
              variant={
                request.status === "pending"
                  ? "warning"
                  : request.status === "approved"
                    ? "success"
                    : "destructive"
              }
            >
              {VERIFICATION_STATUS_LABELS[request.status]}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewDocumentButton storagePath={request.storage_path} />
            {request.status === "pending" && <VerificationReviewActions requestId={request.id} />}
          </div>
          {request.rejection_reason && (
            <p className="text-sm text-red-600">Reason: {request.rejection_reason}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Verification queue</h1>
        <p className="text-muted-foreground">
          Review identity and ownership documents. Approvals award badges automatically.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <EmptyState icon={FileCheck2} title="Queue is clear" description="No documents waiting for review." />
        ) : (
          pending.map((request) => <RequestCard key={request.id} request={request} />)
        )}
      </section>

      {reviewed.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Recently reviewed</h2>
          {reviewed.slice(0, 20).map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </section>
      )}
    </div>
  );
}
