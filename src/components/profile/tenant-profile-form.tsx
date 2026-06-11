"use client";

import * as React from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/auth/field-error";
import { SubmitButton } from "@/components/shared/submit-button";
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
import { FOOD_LABELS, INCOME_LABELS, OCCUPANCY_LABELS } from "@/lib/constants";
import { updateTenantProfile } from "@/server/actions/profile";
import type { ActionResult, TenantProfileRow, UserRow } from "@/types";

export function TenantProfileForm({
  user,
  profile,
}: {
  user: UserRow;
  profile: TenantProfileRow | null;
}) {
  const [state, formAction] = React.useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await updateTenantProfile(formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" defaultValue={user.full_name} required />
          <FieldError errors={errors?.fullName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ""} placeholder="+91" />
          <FieldError errors={errors?.phone} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="occupation">Occupation</Label>
          <Input id="occupation" name="occupation" defaultValue={profile?.occupation ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="employer">Employer</Label>
          <Input id="employer" name="employer" defaultValue={profile?.employer ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label>Income range</Label>
          <Select name="incomeRange" defaultValue={profile?.income_range ?? undefined}>
            <SelectTrigger>
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INCOME_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Occupancy</Label>
          <Select name="occupancyType" defaultValue={profile?.occupancy_type ?? "any"}>
            <SelectTrigger>
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
        <div className="space-y-1.5">
          <Label>Food preference</Label>
          <Select name="foodPreference" defaultValue={profile?.food_preference ?? "no_preference"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FOOD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="budgetMin">Budget min (₹/mo)</Label>
          <Input
            id="budgetMin"
            name="budgetMin"
            type="number"
            min={0}
            defaultValue={profile?.budget_min ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="budgetMax">Budget max (₹/mo)</Label>
          <Input
            id="budgetMax"
            name="budgetMax"
            type="number"
            min={0}
            defaultValue={profile?.budget_max ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="moveInDate">Move-in date</Label>
          <Input
            id="moveInDate"
            name="moveInDate"
            type="date"
            defaultValue={profile?.move_in_date ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
          <Input
            id="linkedinUrl"
            name="linkedinUrl"
            type="url"
            placeholder="https://linkedin.com/in/…"
            defaultValue={profile?.linkedin_url ?? ""}
          />
          <FieldError errors={errors?.linkedinUrl} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="preferredLocations">Preferred locations (comma-separated)</Label>
        <Input
          id="preferredLocations"
          name="preferredLocations"
          placeholder="Indiranagar, HSR Layout, Koramangala"
          defaultValue={profile?.preferred_locations.join(", ") ?? ""}
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch id="hasPets" name="hasPets" defaultChecked={profile?.has_pets ?? false} />
        <Label htmlFor="hasPets">I have pets</Label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="about">About you</Label>
        <Textarea
          id="about"
          name="about"
          placeholder="A short intro helps owners trust you faster."
          defaultValue={profile?.about ?? ""}
        />
      </div>

      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}
