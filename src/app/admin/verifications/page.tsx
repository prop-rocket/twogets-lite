import Link from "next/link";
import { FileCheck2 } from "lucide-react";

import {
  VerificationReviewActions,
  ViewDocumentButton,
} from "@/components/admin/admin-actions";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DOCUMENT_LABELS, VERIFICATION_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { listVerifications } from "@/server/admin-queries";
import type { DocumentType, VerificationWithUser } from "@/types";

export const metadata = { title: "Verification Queue" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

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
          <ViewDocumentButton requestId={request.id} />
          {request.status === "pending" && <VerificationReviewActions requestId={request.id} />}
        </div>
        {request.rejection_reason && (
          <p className="text-sm text-red-600">Reason: {request.rejection_reason}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Queue tabs are URL-driven rather than client tabs: each scope is a separate
 * server query with its own paging, so switching must re-run on the server.
 */
function ScopeTabs({
  scope,
  pendingCount,
  params,
}: {
  scope: "pending" | "reviewed";
  pendingCount: number;
  params: SearchParams;
}) {
  function href(next: "pending" | "reviewed") {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string" && k !== "page" && k !== "scope") sp.set(k, v);
    }
    if (next === "reviewed") sp.set("scope", "reviewed");
    const qs = sp.toString();
    return qs ? `/admin/verifications?${qs}` : "/admin/verifications";
  }

  const tab = "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";
  return (
    <div className="flex gap-1 rounded-xl border p-1">
      <Link
        href={href("pending")}
        className={cn(tab, scope === "pending" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
      >
        Pending{pendingCount > 0 && ` (${pendingCount})`}
      </Link>
      <Link
        href={href("reviewed")}
        className={cn(tab, scope === "reviewed" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
      >
        Reviewed
      </Link>
    </div>
  );
}

const DOC_FILTER = [
  {
    type: "select" as const,
    key: "documentType",
    label: "Document",
    options: Object.entries(DOCUMENT_LABELS).map(([value, label]) => ({ value, label })),
  },
];

export default async function AdminVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const scope = str(params.scope) === "reviewed" ? "reviewed" : "pending";
  const documentType = str(params.documentType) as DocumentType | undefined;

  // The pending count drives the tab badge, so fetch it regardless of scope.
  const [current, pendingQueue] = await Promise.all([
    listVerifications({ scope, documentType, page: Number(str(params.page) ?? 1) }),
    scope === "pending" ? null : listVerifications({ scope: "pending", page: 1 }),
  ]);
  const pendingCount = scope === "pending" ? current.total : (pendingQueue?.total ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Verification queue</h1>
        <p className="text-muted-foreground">
          Review identity and ownership documents. Approvals award badges automatically.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ScopeTabs scope={scope} pendingCount={pendingCount} params={params} />
        <AdminFilterBar fields={DOC_FILTER} />
      </div>

      {current.rows.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title={scope === "pending" ? "Queue is clear" : "Nothing reviewed yet"}
          description={
            scope === "pending"
              ? "No documents waiting for review."
              : "Approved and rejected documents will appear here."
          }
        />
      ) : (
        <div className="space-y-4">
          {current.rows.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}

      <Pagination
        page={current.page}
        pageCount={current.pageCount}
        searchParams={params}
        basePath="/admin/verifications"
      />
    </div>
  );
}
