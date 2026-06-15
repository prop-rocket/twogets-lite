"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/shared/submit-button";
import { submitReview } from "@/server/actions/reviews";
import { cn } from "@/lib/utils";
import type { ReviewType } from "@/types";

function StarInput({ name, label }: { name: string; label: string }) {
  const [value, setValue] = React.useState(0);
  const [hover, setHover] = React.useState(0);

  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <input type="hidden" name={name} value={value || ""} />
      <div className="flex" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setValue(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
          >
            <Star
              className={cn(
                "size-6 transition-colors",
                n <= (hover || value) ? "fill-accent text-accent" : "text-muted-foreground/40",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReviewDialog({
  bookingId,
  reviewType,
  revieweeName,
}: {
  bookingId: string;
  reviewType: ReviewType;
  revieweeName: string;
}) {
  const [open, setOpen] = React.useState(false);

  const dimensions =
    reviewType === "owner_review"
      ? [
          { name: "ratingCommunication", label: "Communication" },
          { name: "ratingDepositFairness", label: "Deposit fairness" },
          { name: "ratingPropertyAccuracy", label: "Property accuracy" },
        ]
      : [
          { name: "ratingCommunication", label: "Communication" },
          { name: "ratingReliability", label: "Reliability" },
          { name: "ratingPropertyCare", label: "Property care" },
        ];

  async function action(formData: FormData) {
    const result = await submitReview(formData);
    if (result.ok) {
      toast.success(result.message);
      setOpen(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="accent">
          <Star />
          Write review
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review {revieweeName}</DialogTitle>
          <DialogDescription>
            Honest reviews keep TwoGets trustworthy for everyone.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="reviewType" value={reviewType} />
          <div className="space-y-3">
            {dimensions.map((dim) => (
              <StarInput key={dim.name} name={dim.name} label={dim.label} />
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comment">Comment (optional)</Label>
            <Textarea id="comment" name="comment" maxLength={2000} />
          </div>
          <SubmitButton className="w-full">Publish review</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
