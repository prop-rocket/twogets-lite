import { Flag } from "lucide-react";

import { EntityLink } from "@/components/admin/entity-link";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { ExportButton, ReportActions } from "@/components/admin/admin-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { listReports } from "@/server/admin-queries";
import type { ReportStatus, ReportTarget } from "@/types";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

const FILTERS = [
  {
    type: "select" as const,
    key: "status",
    label: "Status",
    options: [
      { value: "open", label: "Open" },
      { value: "resolved", label: "Resolved" },
      { value: "dismissed", label: "Dismissed" },
    ],
  },
  {
    type: "select" as const,
    key: "targetType",
    label: "Target",
    options: [
      { value: "user", label: "User" },
      { value: "property", label: "Listing" },
      { value: "review", label: "Review" },
    ],
  },
];

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { rows, total, page, pageCount } = await listReports({
    status: str(params.status) as ReportStatus | undefined,
    targetType: str(params.targetType) as ReportTarget | undefined,
    page: Number(str(params.page) ?? 1),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            Community-flagged users, listings and reviews. {total} match these filters.
          </p>
        </div>
        <ExportButton dataset="reports" />
      </div>

      <AdminFilterBar fields={FILTERS} />

      {rows.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No reports match these filters"
          description="Nothing flagged here."
        />
      ) : (
        <div className="space-y-4">
          {rows.map((report) => (
            <Card key={report.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {report.reason}
                      <Badge variant="secondary" className="ml-2 capitalize">
                        {report.target_type}
                      </Badge>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Reported by {report.reporter?.full_name} ({report.reporter?.email}) ·{" "}
                      {formatDate(report.created_at)} ·{" "}
                      <EntityLink type={report.target_type} id={report.target_id} />
                    </p>
                  </div>
                  <Badge
                    variant={
                      report.status === "open"
                        ? "warning"
                        : report.status === "resolved"
                          ? "success"
                          : "secondary"
                    }
                    className="capitalize"
                  >
                    {report.status}
                  </Badge>
                </div>
                {report.details && <p className="text-sm">{report.details}</p>}
                {report.status === "open" && <ReportActions reportId={report.id} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        searchParams={params}
        basePath="/admin/reports"
      />
    </div>
  );
}
