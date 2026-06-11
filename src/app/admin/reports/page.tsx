import { Flag } from "lucide-react";

import { ReportActions } from "@/components/admin/admin-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Reports" };

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("reports")
    .select("*, reporter:users!reports_reporter_id_fkey(full_name, email)")
    .order("status", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Community-flagged users, listings and reviews.</p>
      </div>

      {!reports?.length ? (
        <EmptyState icon={Flag} title="No reports" description="The community hasn't flagged anything." />
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const reporter = report.reporter as unknown as { full_name: string; email: string };
            return (
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
                        Reported by {reporter?.full_name} ({reporter?.email}) ·{" "}
                        {formatDate(report.created_at)} · target{" "}
                        <span className="font-mono">{report.target_id.slice(0, 8)}</span>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
