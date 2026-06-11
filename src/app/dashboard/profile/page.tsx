import { redirect } from "next/navigation";

import { OwnerProfileForm } from "@/components/profile/owner-profile-form";
import { TenantProfileForm } from "@/components/profile/tenant-profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  if (user.role === "tenant") {
    const { data: profile } = await supabase
      .from("tenant_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Tenant profile</CardTitle>
          <CardDescription>
            Owners see this when you request a viewing — the more complete it is, the faster you get
            a yes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantProfileForm user={user} profile={profile ?? null} />
        </CardContent>
      </Card>
    );
  }

  const { data: profile } = await supabase
    .from("homeowner_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-2xl">Homeowner profile</CardTitle>
        <CardDescription>Shown on every one of your listings.</CardDescription>
      </CardHeader>
      <CardContent>
        <OwnerProfileForm user={user} profile={profile ?? null} />
      </CardContent>
    </Card>
  );
}
