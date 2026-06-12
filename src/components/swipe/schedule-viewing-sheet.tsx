"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowLeft, CalendarCheck, Check, ChevronRight, Heart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/shared/submit-button";
import { formatRent, publicMediaUrl } from "@/lib/utils";
import { requestViewing } from "@/server/actions/inquiries";
import type { SwipeCardItem } from "@/types";

/**
 * Pops after every 3rd right swipe: "schedule viewings now, or keep browsing?"
 * Two views inside one dialog — the shortlisted batch, and a per-home
 * date/time form that submits the existing requestViewing action.
 */
export function ScheduleViewingSheet({
  open,
  onOpenChange,
  cards,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: SwipeCardItem[];
}) {
  const [selected, setSelected] = React.useState<SwipeCardItem | null>(null);
  const [requested, setRequested] = React.useState<Set<string>>(new Set());
  const today = new Date().toISOString().slice(0, 10);

  // Reset to the list view whenever a fresh batch opens.
  React.useEffect(() => {
    if (open) setSelected(null);
  }, [open, cards]);

  async function action(formData: FormData) {
    const result = await requestViewing(formData);
    if (result.ok) {
      toast.success(result.message);
      if (selected) setRequested((r) => new Set(r).add(selected.id));
      setSelected(null);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {selected ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-md p-1 hover:bg-muted"
                  aria-label="Back to shortlist"
                >
                  <ArrowLeft className="size-4" />
                </button>
                Schedule a viewing
              </DialogTitle>
              <DialogDescription className="line-clamp-1">
                {selected.title} · {selected.locality}, {selected.city}
              </DialogDescription>
            </DialogHeader>
            <form action={action} className="space-y-4">
              <input type="hidden" name="propertyId" value={selected.id} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="swipe-preferredDate">Date</Label>
                  <Input id="swipe-preferredDate" name="preferredDate" type="date" min={today} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="swipe-preferredTime">Time</Label>
                  <Input id="swipe-preferredTime" name="preferredTime" type="time" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="swipe-message">Message to the owner (optional)</Label>
                <Textarea
                  id="swipe-message"
                  name="message"
                  placeholder="Introduce yourself — occupation, move-in timeline, who'll be staying…"
                  maxLength={1000}
                />
              </div>
              <SubmitButton className="w-full">
                <CalendarCheck />
                Send request — the owner will confirm
              </SubmitButton>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Heart className="size-5 text-primary" />
                {cards.length} homes shortlisted!
              </DialogTitle>
              <DialogDescription>
                Strike while the iron&apos;s hot — schedule a viewing, or keep browsing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {cards.map((card) => {
                const cover = card.property_images.find((i) => i.is_cover) ?? card.property_images[0];
                const sent = requested.has(card.id);
                return (
                  <button
                    key={card.id}
                    type="button"
                    disabled={sent}
                    onClick={() => setSelected(card)}
                    className="flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors hover:bg-muted disabled:opacity-70"
                  >
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
                      {cover && (
                        <Image
                          src={publicMediaUrl(cover.storage_path)}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold">{card.title}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {formatRent(card.rent)}/mo · {card.locality}, {card.city}
                      </p>
                    </div>
                    {sent ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-green-600">
                        <Check className="size-3.5" />
                        Sent
                      </span>
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Keep browsing
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
