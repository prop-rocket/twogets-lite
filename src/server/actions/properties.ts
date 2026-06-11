"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { propertySchema } from "@/lib/validations";
import type { ActionResult, PropertyStatus } from "@/types";

function parsePropertyForm(formData: FormData) {
  return propertySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    propertyType: formData.get("propertyType"),
    bhk: formData.get("bhk"),
    furnishedStatus: formData.get("furnishedStatus"),
    addressLine: formData.get("addressLine"),
    locality: formData.get("locality"),
    city: formData.get("city"),
    state: formData.get("state"),
    pincode: formData.get("pincode"),
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
    rent: formData.get("rent"),
    deposit: formData.get("deposit") || 0,
    availableFrom: formData.get("availableFrom"),
    petFriendly: formData.get("petFriendly") === "on" || formData.get("petFriendly") === "true",
    preferredTenants: formData.get("preferredTenants") ?? "any",
    videoUrl: formData.get("videoUrl") ?? "",
    amenityIds: formData.getAll("amenityIds").map(String),
    status: formData.get("status") ?? "draft",
  });
}

type ParsedProperty = NonNullable<ReturnType<typeof parsePropertyForm>["data"]>;

function toRow(d: ParsedProperty, ownerId: string) {
  return {
    owner_id: ownerId,
    title: d.title,
    description: d.description,
    property_type: d.propertyType,
    bhk: d.bhk,
    furnished_status: d.furnishedStatus,
    address_line: d.addressLine,
    locality: d.locality,
    city: d.city,
    state: d.state,
    pincode: d.pincode,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    rent: d.rent,
    deposit: d.deposit,
    available_from: d.availableFrom,
    pet_friendly: d.petFriendly,
    preferred_tenants: d.preferredTenants,
    video_url: d.videoUrl || null,
    status: d.status,
  };
}

async function syncImagesAndAmenities(
  propertyId: string,
  amenityIds: number[],
  imagePaths: string[],
) {
  const supabase = await createClient();

  await supabase.from("property_amenities").delete().eq("property_id", propertyId);
  if (amenityIds.length) {
    await supabase
      .from("property_amenities")
      .insert(amenityIds.map((amenity_id) => ({ property_id: propertyId, amenity_id })));
  }

  if (imagePaths.length) {
    const { data: existing } = await supabase
      .from("property_images")
      .select("storage_path")
      .eq("property_id", propertyId);
    const known = new Set((existing ?? []).map((i) => i.storage_path));
    const fresh = imagePaths.filter((p) => !known.has(p));
    if (fresh.length) {
      await supabase.from("property_images").insert(
        fresh.map((storage_path, i) => ({
          property_id: propertyId,
          storage_path,
          sort_order: known.size + i,
          is_cover: known.size === 0 && i === 0,
        })),
      );
    }
  }
}

export async function createProperty(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user || user.role !== "homeowner") return { ok: false, error: "Sign in as a homeowner" };

  const parsed = parsePropertyForm(formData);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: property, error } = await supabase
    .from("properties")
    .insert(toRow(parsed.data, user.id))
    .select("id")
    .single();
  if (error || !property) return { ok: false, error: error?.message ?? "Could not create listing" };

  await syncImagesAndAmenities(
    property.id,
    parsed.data.amenityIds,
    formData.getAll("imagePaths").map(String).filter(Boolean),
  );

  revalidatePath("/dashboard/listings");
  revalidatePath("/properties");
  return { ok: true, data: { id: property.id }, message: "Listing created" };
}

export async function updateProperty(
  propertyId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  const parsed = parsePropertyForm(formData);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  // strip owner_id — ownership can never be reassigned through an edit
  const { owner_id, ...updates } = toRow(parsed.data, user.id);
  void owner_id;
  const { error } = await supabase
    .from("properties")
    .update(updates)
    .eq("id", propertyId)
    .eq("owner_id", user.id); // RLS also enforces this; belt and braces
  if (error) return { ok: false, error: error.message };

  await syncImagesAndAmenities(
    propertyId,
    parsed.data.amenityIds,
    formData.getAll("imagePaths").map(String).filter(Boolean),
  );

  revalidatePath("/dashboard/listings");
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true, message: "Listing updated" };
}

export async function setPropertyStatus(
  propertyId: string,
  status: PropertyStatus,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .update({ status })
    .eq("id", propertyId)
    .eq("owner_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/listings");
  revalidatePath("/properties");
  return { ok: true, message: `Listing ${status === "active" ? "published" : status}` };
}

export async function deleteProperty(propertyId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .delete()
    .eq("id", propertyId)
    .eq("owner_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/listings");
  revalidatePath("/properties");
  return { ok: true, message: "Listing deleted" };
}

export async function deletePropertyImage(imageId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  const supabase = await createClient();
  const { data: image } = await supabase
    .from("property_images")
    .select("id, storage_path, property_id")
    .eq("id", imageId)
    .single();
  if (!image) return { ok: false, error: "Image not found" };

  const { error } = await supabase.from("property_images").delete().eq("id", imageId);
  if (error) return { ok: false, error: error.message };
  await supabase.storage.from("property-media").remove([image.storage_path]);

  revalidatePath(`/dashboard/listings/${image.property_id}/edit`);
  return { ok: true };
}

export async function toggleSaveProperty(propertyId: string): Promise<ActionResult<{ saved: boolean }>> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/properties/${propertyId}`);
  if (user.role !== "tenant") return { ok: false, error: "Only tenants can save properties" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("saved_properties")
    .select("property_id")
    .eq("tenant_id", user.id)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("saved_properties")
      .delete()
      .eq("tenant_id", user.id)
      .eq("property_id", propertyId);
  } else {
    const { error } = await supabase
      .from("saved_properties")
      .insert({ tenant_id: user.id, property_id: propertyId });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/saved");
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true, data: { saved: !existing } };
}
