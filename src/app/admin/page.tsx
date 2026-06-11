import Link from "next/link";
import { Building2, FileCheck2, Flag, Star, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Admin Overview" };

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [users, listings, pendingVerifications, reviews, openReports, recentLogs] =
    await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase.from("properties").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase
        .from("verification_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("reviews").select("*", { count: "exact", head: true }),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(10),
    ]);

  const stats = [
    { label: "Total users", value: users.count ?? 0, icon: Users, href: "/admin/users" },
    { label: "Live listings", value: listings.count ?? 0, icon: Building2, href: "/admin/listings" },
    {
      label: "Pending verifications",
      value: pendingVerifications.count ?? 0,
      icon: FileCheck2,
      href: "/admin/verifications",
    },
    { label: "Reviews", value: reviews.count ?? 0, icon: Star, href: "/admin/reviews" },
    { label: "Open reports", value: openReports.count ?? 0, icon: Flag, href: "/admin/reports" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Admin overview</h1>
        <p className="text-muted-foreground">Platform health at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="space-y-1 p-4">
                <stat.icon className="size-5 text-primary" />
                <p className="font-display text-3xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Recent audit activity</h2>
        {!recentLogs.data?.length ? (
          <p className="text-sm text-muted-foreground">No audit entries yet.</p>
        ) : (
          <div className="divide-y rounded-xl border">
            {recentLogs.data.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <span className="font-mono font-semibold text-primary">{log.action}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {log.entity_type} {log.entity_id.slice(0, 8)}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(log.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
