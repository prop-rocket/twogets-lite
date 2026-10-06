import Link from "next/link";

import { Funnel, ShareBars, SignupBars, StatTile } from "@/components/admin/analytics-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getAdminAnalytics } from "@/server/admin-queries";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const RANGES = [7, 30, 90];

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const raw = Number(typeof params.days === "string" ? params.days : 30);
  const days = RANGES.includes(raw) ? raw : 30;

  const { signups, cities, funnel, viewings, verification, users } =
    await getAdminAnalytics(days);

  const n = (o: Record<string, number>, k: string) => Number(o[k] ?? 0);
  const attended = n(viewings, "attended");
  const noShow = n(viewings, "no_show");
  const showRate = attended + noShow > 0 ? Math.round((attended / (attended + noShow)) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">How the marketplace is actually performing.</p>
        </div>
        <div className="flex gap-1 rounded-xl border p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/analytics?days=${r}`}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                r === days ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {r}d
            </Link>
          ))}
        </div>
      </div>

      {/* Who's here */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Accounts" value={n(users, "total")} hint={`${n(users, "verified")} verified`} />
        <StatTile label="Can host" value={n(users, "hosts")} hint={`${n(users, "dual")} also renting`} />
        <StatTile label="On Plus" value={n(users, "plus")} hint={`${n(users, "free")} on free`} />
        <StatTile
          label="Banned"
          value={n(users, "banned")}
          tone={n(users, "banned") > 0 ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Signups</CardTitle>
          </CardHeader>
          <CardContent>
            <SignupBars points={signups} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Funnel · last {days} days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Funnel
              stages={[
                { label: "Swiped right", value: n(funnel, "swiped_right") },
                { label: "Shortlisted", value: n(funnel, "shortlisted") },
                { label: "Requested a viewing", value: n(funnel, "requested") },
                { label: "Owner accepted", value: n(funnel, "accepted") },
                { label: "Attended", value: n(funnel, "attended") },
                { label: "Reviewed", value: n(funnel, "reviewed") },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* Viewing health — the request/accept gap is the owner-responsiveness signal */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Viewings · last {days} days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Awaiting an owner"
              value={n(viewings, "pending")}
              hint={`${n(viewings, "stale_requests")} over 2 days old`}
              tone={n(viewings, "stale_requests") > 0 ? "warn" : "default"}
            />
            <StatTile label="Accepted" value={n(viewings, "confirmed")} />
            <StatTile label="Declined" value={n(viewings, "declined")} />
            <StatTile
              label="Turn-up rate"
              value={showRate === null ? "—" : `${showRate}%`}
              hint={`${attended} attended · ${noShow} no-show`}
              tone={showRate !== null && showRate < 60 ? "warn" : "good"}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Supply by city</CardTitle>
          </CardHeader>
          <CardContent>
            {cities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No listings yet.</p>
            ) : (
              <ShareBars
                rows={cities.map((c) => ({
                  label: c.city,
                  value: Number(c.total),
                  sub: `${c.active} active · ${c.verified} verified`,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Verification queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatTile
                label="Pending documents"
                value={n(verification, "pending")}
                hint={`oldest ${n(verification, "oldest_pending_days")}d`}
                tone={n(verification, "oldest_pending_days") > 3 ? "warn" : "default"}
              />
              <StatTile
                label="Avg time to review"
                value={`${n(verification, "avg_hours_to_review")}h`}
              />
              <StatTile label="Approved" value={n(verification, "approved")} />
              <StatTile
                label="Owners to call"
                value={n(verification, "awaiting_owner_call")}
                hint="non-self listings"
                tone={n(verification, "awaiting_owner_call") > 0 ? "warn" : "default"}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
