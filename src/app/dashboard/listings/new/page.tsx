import { redirect } from "next/navigation";

import { PropertyForm } from "@/components/listing/property-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata = { title: "New Listing" };

export default async function NewListingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "homeowner") redirect("/dashboard");

  const supabase = await createClient();
  const { data: amenities } = await supabase.from("amenities").select("*").order("label");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-2xl">Create a new listing</CardTitle>
        <CardDescription>
          Complete listings with photos get 3× more viewing requests. Publish when ready, or save a
          draft.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PropertyForm userId={user.id} amenities={amenities ?? []} />
      </CardContent>
    </Card>
  );
}
