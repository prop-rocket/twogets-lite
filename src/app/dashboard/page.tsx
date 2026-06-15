import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, CalendarDays, Eye, Heart, ShieldCheck } from "lucide-react";

import { TrustScore } from "@/components/shared/trust-score";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { tenantProfileCompletion } from "@/server/actions/profile";

export const metadata = { title: "Dashboard" };

function StatCard({
  title,
  value,
  icon: Icon,
  href,
}: {
  title: string;
  value: string | number;
  icon: typeof Heart;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="font-display text-3xl font-bold">{value}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="size-5 text-primary" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  if (user.role === "tenant") {
    const [{ data: profile }, { count: savedCount }, { data: bookings }] = await Promise.all([
      supabase.from("tenant_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("saved_properties").select("*", { count: "exact", head: true }).eq("tenant_id", user.id),
      supabase
        .from("viewing_bookings")
        .select("id, slot:viewing_slots!viewing_bookings_slot_id_fkey(starts_at)")
        .eq("tenant_id", user.id)
        .eq("status", "confirmed"),
    ]);

    const upcomingCount = (bookings ?? []).filter(
      (b) => new Date((b.slot as unknown as { starts_at: string }).starts_at) > new Date(),
    ).length;

    const completion = await tenantProfileCompletion(profile ?? null, user.phone);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">
              Hi {user.full_name.split(" ")[0] || "there"} 👋
            </h1>
            <p className="text-muted-foreground">Here&apos;s your home search at a glance.</p>
          </div>
          <div className="flex items-center gap-3">
            {user.is_verified ? <VerifiedBadge kind="tenant" /> : <Badge variant="warning">Not verified</Badge>}
            <TrustScore score={Number(user.trust_score)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard title="Saved homes" value={savedCount ?? 0} icon={Heart} href="/dashboard/saved" />
          <StatCard
            title="Upcoming viewings"
            value={upcomingCount}
            icon={CalendarDays}
            href="/dashboard/viewings"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Profile completion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  A complete profile gets owners to say yes faster.
                </span>
                <span className="font-display text-lg font-bold text-primary">{completion}%</span>
              </div>
              <Progress value={completion} />
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/profile">
                  Complete profile <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Verification status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {user.is_verified
                  ? "You're verified! Your badge is visible to every owner."
                  : "Upload your Aadhaar and PAN to earn the Verified Tenant badge."}
              </p>
              <Button asChild variant={user.is_verified ? "outline" : "default"} size="sm">
                <Link href="/dashboard/verification">
                  <ShieldCheck />
                  {user.is_verified ? "View documents" : "Get verified"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Homeowner dashboard
  const [{ count: listingCount }, { count: activeCount }, { data: futureSlots }, { data: viewsData }] =
    await Promise.all([
      supabase.from("properties").select("*", { count: "exact", head: true }).eq("owner_id", user.id),
      supabase
        .from("properties")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .eq("status", "active"),
      supabase
        .from("viewing_slots")
        .select("id")
        .eq("owner_id", user.id)
        .eq("status", "open")
        .gt("starts_at", new Date().toISOString()),
      supabase.from("properties").select("view_count").eq("owner_id", user.id),
    ]);

  const slotIds = (futureSlots ?? []).map((s) => s.id);
  let upcomingViewings = 0;
  if (slotIds.length) {
    const { count } = await supabase
      .from("viewing_bookings")
      .select("*", { count: "exact", head: true })
      .in("slot_id", slotIds)
      .eq("status", "confirmed");
    upcomingViewings = count ?? 0;
  }

  const totalViews = (viewsData ?? []).reduce((sum, p) => sum + p.view_count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">
            Hi {user.full_name.split(" ")[0] || "there"} 👋
          </h1>
          <p className="text-muted-foreground">Your properties at a glance.</p>
        </div>
        <div className="flex items-center gap-3">
          {user.is_verified ? <VerifiedBadge kind="owner" /> : <Badge variant="warning">Not verified</Badge>}
          <TrustScore score={Number(user.trust_score)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total listings" value={listingCount ?? 0} icon={Building2} href="/dashboard/listings" />
        <StatCard title="Live listings" value={activeCount ?? 0} icon={Building2} href="/dashboard/listings" />
        <StatCard
          title="Upcoming viewings"
          value={upcomingViewings}
          icon={CalendarDays}
          href="/dashboard/viewings"
        />
        <StatCard title="Total views" value={totalViews} icon={Eye} href="/dashboard/listings" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Verification status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {user.is_verified
                ? "You're a Verified Owner — your listings rank higher and convert better."
                : "Verify your identity, then verify each property with an ownership document."}
            </p>
            <Button asChild variant={user.is_verified ? "outline" : "default"} size="sm">
              <Link href="/dashboard/verification">
                <ShieldCheck />
                {user.is_verified ? "View documents" : "Get verified"}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Add a new property</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Listings with photos and complete details get 3× more viewing requests.
            </p>
            <Button asChild variant="accent" size="sm">
              <Link href="/dashboard/listings/new">
                <Building2 />
                Create listing
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
