"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/auth/field-error";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  FURNISHED_LABELS,
  OCCUPANCY_LABELS,
  PROPERTY_TYPE_LABELS,
} from "@/lib/constants";
import { publicMediaUrl } from "@/lib/utils";
import { createProperty, deletePropertyImage, updateProperty } from "@/server/actions/properties";
import type { ActionResult, AmenityRow, PropertyImageRow, PropertyRow } from "@/types";

export function PropertyForm({
  userId,
  amenities,
  property,
  selectedAmenityIds = [],
  existingImages = [],
}: {
  userId: string;
  amenities: AmenityRow[];
  property?: PropertyRow;
  selectedAmenityIds?: number[];
  existingImages?: PropertyImageRow[];
}) {
  const router = useRouter();
  const isEdit = Boolean(property);
  const [uploadedPaths, setUploadedPaths] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    setUploading(true);
    const supabase = createClient();
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} is over 50 MB`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from("property-media")
          .upload(path, file, { contentType: file.type });
        if (error) {
          toast.error(`${file.name}: ${error.message}`);
        } else {
          setUploadedPaths((prev) => [...prev, path]);
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const [state, formAction] = React.useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      uploadedPaths.forEach((path) => formData.append("imagePaths", path));
      const result = isEdit
        ? await updateProperty(property!.id, formData)
        : await createProperty(formData);
      if (result.ok) {
        toast.success(result.message);
        router.push("/dashboard/listings");
      } else {
        toast.error(result.error);
      }
      return result as ActionResult;
    },
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-8">
      {/* Basics */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Basics</h2>
        <div className="space-y-1.5">
          <Label htmlFor="title">Listing title</Label>
          <Input
            id="title"
            name="title"
            placeholder="Sunny 2BHK near Indiranagar metro"
            defaultValue={property?.title}
            required
          />
          <FieldError errors={errors?.title} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            placeholder="What makes this home great? Neighbourhood, light, commute, house rules…"
            defaultValue={property?.description}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Property type</Label>
            <Select name="propertyType" defaultValue={property?.property_type ?? "apartment"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>BHK</Label>
            <Select name="bhk" defaultValue={String(property?.bhk ?? 2)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} BHK
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Furnishing</Label>
            <Select name="furnishedStatus" defaultValue={property?.furnished_status ?? "unfurnished"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FURNISHED_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Location</h2>
        <div className="space-y-1.5">
          <Label htmlFor="addressLine">Address</Label>
          <Input id="addressLine" name="addressLine" defaultValue={property?.address_line} required />
          <FieldError errors={errors?.addressLine} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="locality">Locality</Label>
            <Input id="locality" name="locality" defaultValue={property?.locality} required />
            <FieldError errors={errors?.locality} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={property?.city} required />
            <FieldError errors={errors?.city} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Input id="state" name="state" defaultValue={property?.state} required />
            <FieldError errors={errors?.state} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pincode">PIN code</Label>
            <Input
              id="pincode"
              name="pincode"
              inputMode="numeric"
              pattern="\d{6}"
              defaultValue={property?.pincode}
              required
            />
            <FieldError errors={errors?.pincode} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="latitude">Latitude (optional)</Label>
            <Input
              id="latitude"
              name="latitude"
              type="number"
              step="any"
              defaultValue={property?.latitude ?? ""}
              placeholder="12.9716"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="longitude">Longitude (optional)</Label>
            <Input
              id="longitude"
              name="longitude"
              type="number"
              step="any"
              defaultValue={property?.longitude ?? ""}
              placeholder="77.5946"
            />
          </div>
        </div>
      </section>

      {/* Pricing & availability */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Rent & availability</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="rent">Monthly rent (₹)</Label>
            <Input id="rent" name="rent" type="number" min={1} defaultValue={property?.rent} required />
            <FieldError errors={errors?.rent} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deposit">Security deposit (₹)</Label>
            <Input
              id="deposit"
              name="deposit"
              type="number"
              min={0}
              defaultValue={property?.deposit ?? 0}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="availableFrom">Available from</Label>
            <Input
              id="availableFrom"
              name="availableFrom"
              type="date"
              defaultValue={property?.available_from ?? new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Switch id="petFriendly" name="petFriendly" defaultChecked={property?.pet_friendly} />
            <Label htmlFor="petFriendly">Pet friendly</Label>
          </div>
          <div className="flex items-center gap-3">
            <Label>Preferred tenants</Label>
            <Select name="preferredTenants" defaultValue={property?.preferred_tenants ?? "any"}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OCCUPANCY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Media */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Photos & video</h2>
        {existingImages.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {existingImages.map((image) => (
              <div key={image.id} className="group relative h-24 w-32 overflow-hidden rounded-lg border">
                <Image
                  src={publicMediaUrl(image.storage_path)}
                  alt={image.alt_text}
                  fill
                  sizes="128px"
                  className="object-cover"
                />
                <button
                  type="button"
                  aria-label="Delete photo"
                  className="absolute right-1 top-1 hidden rounded-md bg-black/70 p-1 text-white group-hover:block"
                  onClick={async () => {
                    const result = await deletePropertyImage(image.id);
                    if (result.ok) {
                      toast.success("Photo removed");
                      router.refresh();
                    } else toast.error(result.error);
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && void handleFiles(e.target.files)}
        />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus />
            {uploading ? "Uploading…" : "Add photos"}
          </Button>
          {uploadedPaths.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {uploadedPaths.length} new photo{uploadedPaths.length > 1 ? "s" : ""} ready — saved
              with the listing
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="videoUrl">Video tour URL (optional)</Label>
          <Input
            id="videoUrl"
            name="videoUrl"
            type="url"
            placeholder="https://youtube.com/watch?v=…"
            defaultValue={property?.video_url ?? ""}
          />
          <FieldError errors={errors?.videoUrl} />
        </div>
      </section>

      {/* Amenities */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Amenities</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {amenities.map((amenity) => (
            <label key={amenity.id} className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                name="amenityIds"
                value={String(amenity.id)}
                defaultChecked={selectedAmenityIds.includes(amenity.id)}
              />
              {amenity.label}
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t pt-6">
        <SubmitButton name="status" value="active" size="lg">
          {isEdit ? "Save & publish" : "Publish listing"}
        </SubmitButton>
        <SubmitButton name="status" value="draft" variant="outline" size="lg">
          Save as draft
        </SubmitButton>
      </div>
    </form>
  );
}
