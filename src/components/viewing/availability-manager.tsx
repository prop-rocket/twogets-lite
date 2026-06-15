"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Repeat } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubmitButton } from "@/components/shared/submit-button";
import { SLOT_DURATION_OPTIONS, WEEKDAY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { addOneOffSlots, addRecurringRule } from "@/server/actions/viewings";
import type { ActionResult } from "@/types";

const todayStr = () => new Date().toISOString().slice(0, 10);

function DurationSelect() {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="slotDurationMin">Split into slots</Label>
      <select
        id="slotDurationMin"
        name="slotDurationMin"
        defaultValue=""
        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {SLOT_DURATION_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CapacityInput() {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="capacity">Max tenants / slot</Label>
      <Input id="capacity" name="capacity" type="number" min={1} max={500} placeholder="Unlimited" />
    </div>
  );
}

export function AvailabilityManager({ propertyId }: { propertyId: string }) {
  const router = useRouter();

  function handler(action: (fd: FormData) => Promise<ActionResult>) {
    return async (formData: FormData) => {
      const result = await action(formData);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        (document.getElementById("availability-forms") as HTMLElement | null)
          ?.querySelectorAll("form")
          .forEach((f) => f.reset());
      } else {
        toast.error(result.error);
      }
    };
  }

  return (
    <div id="availability-forms">
      <Tabs defaultValue="oneoff">
        <TabsList>
          <TabsTrigger value="oneoff">
            <CalendarPlus className="size-4" />
            One-off
          </TabsTrigger>
          <TabsTrigger value="recurring">
            <Repeat className="size-4" />
            Recurring
          </TabsTrigger>
        </TabsList>

        {/* One-off slot */}
        <TabsContent value="oneoff">
          <form action={handler(addOneOffSlots)} className="space-y-4">
            <input type="hidden" name="propertyId" value={propertyId} />
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" min={todayStr()} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startTime">From</Label>
                <Input id="startTime" name="startTime" type="time" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endTime">To</Label>
                <Input id="endTime" name="endTime" type="time" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DurationSelect />
              <CapacityInput />
            </div>
            <SubmitButton className="w-full">Publish availability</SubmitButton>
          </form>
        </TabsContent>

        {/* Recurring rule */}
        <TabsContent value="recurring">
          <form action={handler(addRecurringRule)} className="space-y-4">
            <input type="hidden" name="propertyId" value={propertyId} />
            <div className="space-y-1.5">
              <Label>Repeat on</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_LABELS.map((label, i) => (
                  <label
                    key={label}
                    className={cn(
                      "cursor-pointer select-none rounded-lg border px-3 py-1.5 text-sm transition-colors",
                      "has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                    )}
                  >
                    <input type="checkbox" name="daysOfWeek" value={i} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-startTime">From</Label>
                <Input id="r-startTime" name="startTime" type="time" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-endTime">To</Label>
                <Input id="r-endTime" name="endTime" type="time" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DurationSelect />
              <CapacityInput />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="validUntil">Repeat until (optional)</Label>
              <Input id="validUntil" name="validUntil" type="date" min={todayStr()} />
            </div>
            <p className="text-xs text-muted-foreground">
              Slots are published across the next 4 weeks and refreshed daily.
            </p>
            <SubmitButton className="w-full">Save recurring availability</SubmitButton>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
