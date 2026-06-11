import { notFound, redirect } from "next/navigation";

import { PropertyForm } from "@/components/listing/property-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata = { title: "Edit Listing" };

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "homeowner") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: property }, { data: amenities }, { data: propertyAmenities }, { data: images }] =
    await Promise.all([
      supabase.from("properties").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle(),
      supabase.from("amenities").select("*").order("label"),
      supabase.from("property_amenities").select("amenity_id").eq("property_id", id),
      supabase.from("property_images").select("*").eq("property_id", id).order("sort_order"),
    ]);

  if (!property) notFound();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-2xl">Edit listing</CardTitle>
        <CardDescription>{property.title}</CardDescription>
      </CardHeader>
      <CardContent>
        <PropertyForm
          userId={user.id}
          amenities={amenities ?? []}
          property={property}
          selectedAmenityIds={(propertyAmenities ?? []).map((pa) => pa.amenity_id)}
          existingImages={images ?? []}
        />
      </CardContent>
    </Card>
  );
}
