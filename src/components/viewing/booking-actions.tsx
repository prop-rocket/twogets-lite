"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cancelBooking } from "@/server/actions/viewings";

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await cancelBooking(bookingId);
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else toast.error(result.error);
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
      Cancel
    </Button>
  );
}
