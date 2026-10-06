import Link from "next/link";
import { IndianRupee } from "lucide-react";

import { StatTile } from "@/components/admin/analytics-charts";
import { RecordPaymentForm } from "@/components/admin/record-payment-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatRent } from "@/lib/utils";
import { getAdminBilling } from "@/server/admin-queries";

export const metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

/** Stored as integer paise; shown as rupees. */
const rupees = (paise: number) => formatRent(Math.round((paise ?? 0) / 100));

export default async function AdminPaymentsPage() {
  const { summary, subscriptions, transactions, plans } = await getAdminBilling();
  const n = (k: string) => Number(summary[k] ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Payments</h1>
        <p className="text-muted-foreground">
          No gateway is connected yet — these are records kept by hand. Plans follow
          subscriptions automatically.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Collected (30d)" value={rupees(n("captured_paise"))} hint={`${n("txn_count")} payments`} />
        <StatTile label="MRR" value={rupees(n("mrr_paise"))} hint="active monthly plans" tone="good" />
        <StatTile label="Active subscriptions" value={n("active_subs")} />
        <StatTile
          label="Refunded (30d)"
          value={rupees(n("refunded_paise"))}
          hint={`${n("failed_count")} failed`}
          tone={n("failed_count") > 0 ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Record a payment</CardTitle>
          </CardHeader>
          <CardContent>
            <RecordPaymentForm plans={plans} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
            ) : (
              subscriptions.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0"
                >
                  {s.user ? (
                    <Link
                      href={`/admin/users/${s.user.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {s.user.full_name}
                    </Link>
                  ) : (
                    <span>—</span>
                  )}
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant={s.status === "active" ? "success" : "secondary"}>
                      {s.status}
                    </Badge>
                    <span className="capitalize">{s.plan_code}</span>
                    {s.current_period_end && <>until {formatDate(s.current_period_end)}</>}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Recent payments</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <EmptyState
              icon={IndianRupee}
              title="No payments recorded"
              description="Record one above, or connect a gateway later."
            />
          ) : (
            transactions.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0"
              >
                <span className="flex items-center gap-2">
                  {t.user ? (
                    <Link
                      href={`/admin/users/${t.user.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {t.user.full_name}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {t.method && <span className="text-xs text-muted-foreground">{t.method}</span>}
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant={t.status === "captured" ? "success" : "secondary"}>
                    {t.status}
                  </Badge>
                  <span className="font-medium text-foreground">{rupees(t.amount_paise)}</span>
                  {formatDate(t.created_at)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
