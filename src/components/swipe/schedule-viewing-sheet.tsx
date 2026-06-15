"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowLeft, ChevronRight, Heart, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SlotPicker } from "@/components/viewing/slot-picker";
import { formatRent, publicMediaUrl } from "@/lib/utils";
import { listOpenSlots } from "@/server/actions/viewings";
import type { SwipeCardItem, TenantSlot } from "@/types";

/**
 * Pops after every 3rd right swipe: "book a viewing now, or keep browsing?"
 * Two views inside one dialog — the shortlisted batch, and a per-home slot
 * picker. Tenants only ever book the owner's published times (no custom entry).
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
  const [slots, setSlots] = React.useState<TenantSlot[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Reset to the list view whenever a fresh batch opens.
  React.useEffect(() => {
    if (open) setSelected(null);
  }, [open, cards]);

  async function openHome(card: SwipeCardItem) {
    setSelected(card);
    setLoading(true);
    try {
      setSlots(await listOpenSlots(card.id));
    } finally {
      setLoading(false);
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
                Book a viewing
              </DialogTitle>
              <DialogDescription className="line-clamp-1">
                {selected.title} · {selected.locality}, {selected.city}
              </DialogDescription>
            </DialogHeader>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <SlotPicker slots={slots} canBook loginHref={`/login?next=/properties/${selected.id}`} />
              </div>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Heart className="size-5 text-primary" />
                {cards.length} homes shortlisted!
              </DialogTitle>
              <DialogDescription>
                Strike while the iron&apos;s hot — book a viewing, or keep browsing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {cards.map((card) => {
                const cover = card.property_images.find((i) => i.is_cover) ?? card.property_images[0];
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => openHome(card)}
                    className="flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors hover:bg-muted"
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
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
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
