"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleSaveProperty } from "@/server/actions/properties";
import { cn } from "@/lib/utils";

export function SaveButton({
  propertyId,
  initialSaved,
}: {
  propertyId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = React.useState(initialSaved);
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleSaveProperty(propertyId);
          if (result.ok && result.data) {
            setSaved(result.data.saved);
            toast.success(result.data.saved ? "Saved to your list" : "Removed from saved");
          } else if (!result.ok) {
            toast.error(result.error);
          }
        })
      }
    >
      <Heart className={cn(saved && "fill-red-500 text-red-500")} />
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
