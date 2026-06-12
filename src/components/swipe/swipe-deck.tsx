"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BedDouble, ExternalLink, Heart, MapPin, PawPrint, RotateCcw, Search, Sofa, X } from "lucide-react";
import { toast } from "sonner";

import { ScheduleViewingSheet } from "@/components/swipe/schedule-viewing-sheet";
import { UpgradeDialog } from "@/components/swipe/upgrade-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { FREE_DAILY_RIGHT_SWIPES, FURNISHED_LABELS, PROPERTY_TYPE_LABELS, VIEWING_PROMPT_EVERY } from "@/lib/constants";
import { cn, formatRent, publicMediaUrl } from "@/lib/utils";
import { recordSwipe } from "@/server/actions/swipes";
import type { SwipeCardItem, SwipeDirection } from "@/types";

const SWIPE_THRESHOLD = 100;
const FLY_OUT_MS = 300;

interface SwipeDeckProps {
  initialCards: SwipeCardItem[];
  /** Right swipes left today; null = unlimited (Plus). */
  initialRemaining: number | null;
  isTenant: boolean;
  signedIn: boolean;
  /** The raw search text, used to return here after login. */
  query: string;
}

export function SwipeDeck({ initialCards, initialRemaining, isTenant, signedIn, query }: SwipeDeckProps) {
  const router = useRouter();
  const [cards, setCards] = React.useState(initialCards);
  const [remaining, setRemaining] = React.useState(initialRemaining);
  const [drag, setDrag] = React.useState({ dx: 0, dy: 0, dragging: false });
  const [leaving, setLeaving] = React.useState<SwipeDirection | null>(null);
  const [rightBatch, setRightBatch] = React.useState<SwipeCardItem[]>([]);
  const [sheetCards, setSheetCards] = React.useState<SwipeCardItem[]>([]);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);
  const startRef = React.useRef<{ x: number; y: number } | null>(null);
  const busyRef = React.useRef(false);

  const top = cards[0];
  const loginNext = `/login?next=${encodeURIComponent(`/swipe?q=${encodeURIComponent(query)}`)}`;

  function commit(direction: SwipeDirection) {
    if (!top || busyRef.current) return;

    if (direction === "right") {
      if (!signedIn) {
        // Capture the lead at the moment of intent.
        router.push(loginNext);
        return;
      }
      if (!isTenant) {
        toast.error("Swiping is for tenants");
        setDrag({ dx: 0, dy: 0, dragging: false });
        return;
      }
      if (remaining === 0) {
        setDrag({ dx: 0, dy: 0, dragging: false });
        setUpgradeOpen(true);
        return;
      }
    }

    busyRef.current = true;
    setLeaving(direction);

    window.setTimeout(() => {
      const card = top;
      setCards((c) => c.slice(1));
      setLeaving(null);
      setDrag({ dx: 0, dy: 0, dragging: false });
      busyRef.current = false;

      if (!signedIn || !isTenant) return; // anonymous left swipes are local-only

      void recordSwipe(card.id, direction).then((res) => {
        if (!res.ok) {
          if (res.code === "quota") {
            setCards((c) => [card, ...c]); // give the card back
            setRemaining(0);
            setUpgradeOpen(true);
          } else if (res.code !== "gone") {
            toast.error(res.error);
          }
          return;
        }
        setRemaining(res.data?.remaining ?? null);
        if (direction === "right") {
          const batch = [...rightBatch, card];
          if (batch.length >= VIEWING_PROMPT_EVERY) {
            setSheetCards(batch);
            setSheetOpen(true);
            setRightBatch([]);
          } else {
            setRightBatch(batch);
          }
        }
      });
    }, FLY_OUT_MS);
  }

  // Keyboard: ← skip, → shortlist.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (sheetOpen || upgradeOpen) return;
      if (e.key === "ArrowLeft") commit("left");
      if (e.key === "ArrowRight") commit("right");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onPointerDown(e: React.PointerEvent) {
    if (leaving || busyRef.current) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ dx: 0, dy: 0, dragging: true });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.dragging || !startRef.current) return;
    setDrag({ dx: e.clientX - startRef.current.x, dy: e.clientY - startRef.current.y, dragging: true });
  }

  function onPointerUp() {
    if (!drag.dragging) return;
    startRef.current = null;
    if (Math.abs(drag.dx) > SWIPE_THRESHOLD) commit(drag.dx > 0 ? "right" : "left");
    else setDrag({ dx: 0, dy: 0, dragging: false });
  }

  if (!top) {
    return (
      <Card className="mx-auto w-full max-w-sm p-8 text-center">
        <div className="space-y-4">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Search className="size-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">That&apos;s everything</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;ve seen every home matching this search. Broaden it, or check your shortlist.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link href="/swipe">
                <RotateCcw />
                Try a broader search
              </Link>
            </Button>
            {signedIn && isTenant && (
              <Button asChild variant="outline">
                <Link href="/dashboard/saved">
                  <Heart />
                  View my shortlist
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost">
              <Link href="/properties">Browse the full grid</Link>
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const dx = leaving === "right" ? 600 : leaving === "left" ? -600 : drag.dx;
  const dy = leaving ? drag.dy - 40 : drag.dy * 0.4;
  const rotation = dx * 0.06;
  const likeOpacity = Math.min(Math.max(dx, 0) / SWIPE_THRESHOLD, 1);
  const nopeOpacity = Math.min(Math.max(-dx, 0) / SWIPE_THRESHOLD, 1);

  return (
    <div className="mx-auto w-full max-w-sm space-y-4">
      {/* quota meter */}
      {signedIn && isTenant && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {remaining === null ? (
            <Badge variant="accent">Plus · Unlimited shortlists</Badge>
          ) : (
            <>
              <span className="flex gap-1">
                {Array.from({ length: FREE_DAILY_RIGHT_SWIPES }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "size-2 rounded-full",
                      i < FREE_DAILY_RIGHT_SWIPES - remaining ? "bg-primary" : "bg-border",
                    )}
                  />
                ))}
              </span>
              {remaining} of {FREE_DAILY_RIGHT_SWIPES} shortlists left today
            </>
          )}
        </div>
      )}

      {/* the stack */}
      <div className="relative h-[520px] select-none" style={{ touchAction: "pan-y" }}>
        {cards
          .slice(0, 3)
          .map((card, i) => (
            <DeckCard
              key={card.id}
              card={card}
              depth={i}
              style={
                i === 0
                  ? {
                      transform: `translate(${dx}px, ${dy}px) rotate(${rotation}deg)`,
                      transition: drag.dragging ? "none" : `transform ${FLY_OUT_MS}ms ease-out`,
                    }
                  : undefined
              }
              likeOpacity={i === 0 ? likeOpacity : 0}
              nopeOpacity={i === 0 ? nopeOpacity : 0}
              handlers={
                i === 0
                  ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }
                  : undefined
              }
            />
          ))
          .reverse()}
      </div>

      {/* action buttons */}
      <div className="flex items-center justify-center gap-6">
        <Button
          variant="outline"
          size="icon"
          aria-label="Not interested"
          className="size-14 rounded-full border-2 text-destructive hover:bg-destructive/10"
          onClick={() => commit("left")}
        >
          <X className="size-6" />
        </Button>
        <Button
          size="icon"
          aria-label="Shortlist this home"
          className="size-16 rounded-full bg-primary shadow-lg"
          onClick={() => commit("right")}
        >
          <Heart className="size-7" />
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Swipe right to shortlist · left to skip · or use ← → keys
      </p>

      <ScheduleViewingSheet open={sheetOpen} onOpenChange={setSheetOpen} cards={sheetCards} />
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} signedIn={signedIn} />
    </div>
  );
}

function DeckCard({
  card,
  depth,
  style,
  likeOpacity,
  nopeOpacity,
  handlers,
}: {
  card: SwipeCardItem;
  depth: number;
  style?: React.CSSProperties;
  likeOpacity: number;
  nopeOpacity: number;
  handlers?: Pick<
    React.HTMLAttributes<HTMLDivElement>,
    "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel"
  >;
}) {
  const cover = card.property_images.find((i) => i.is_cover) ?? card.property_images[0];

  return (
    <div
      {...handlers}
      className={cn(
        "absolute inset-0 overflow-hidden rounded-2xl border bg-card shadow-xl",
        depth === 0 ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
      )}
      style={{
        ...style,
        ...(depth > 0 && {
          transform: `scale(${1 - depth * 0.04}) translateY(${depth * 12}px)`,
          transition: "transform 200ms ease-out",
        }),
        zIndex: 10 - depth,
      }}
    >
      {/* photo */}
      <div className="absolute inset-0 bg-secondary">
        {cover ? (
          <Image
            src={publicMediaUrl(cover.storage_path)}
            alt={cover.alt_text || card.title}
            fill
            sizes="(max-width: 640px) 100vw, 400px"
            className="object-cover"
            priority={depth === 0}
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No photos yet
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
      </div>

      {/* LIKE / NOPE stamps */}
      <span
        className="absolute left-5 top-6 -rotate-12 rounded-lg border-4 border-green-400 px-3 py-1 font-display text-2xl font-bold text-green-400"
        style={{ opacity: likeOpacity }}
      >
        LIKE
      </span>
      <span
        className="absolute right-5 top-6 rotate-12 rounded-lg border-4 border-red-400 px-3 py-1 font-display text-2xl font-bold text-red-400"
        style={{ opacity: nopeOpacity }}
      >
        NOPE
      </span>

      {/* badges */}
      <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
        {card.close_match && <Badge variant="warning">Close match</Badge>}
        {card.is_verified && <VerifiedBadge kind="property" />}
        {card.owner.is_verified && <VerifiedBadge kind="owner" />}
      </div>

      {/* info */}
      <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 text-white">
        <p className="font-display text-3xl font-bold">
          {formatRent(card.rent)}
          <span className="text-base font-medium text-white/70">/mo</span>
        </p>
        <h3 className="line-clamp-1 font-display text-xl font-semibold">{card.title}</h3>
        <p className="flex items-center gap-1 text-sm text-white/80">
          <MapPin className="size-3.5 shrink-0" />
          <span className="line-clamp-1">
            {card.locality}, {card.city}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
          <span className="inline-flex items-center gap-1">
            <BedDouble className="size-3.5" />
            {card.bhk} BHK · {PROPERTY_TYPE_LABELS[card.property_type]}
          </span>
          <span className="inline-flex items-center gap-1">
            <Sofa className="size-3.5" />
            {FURNISHED_LABELS[card.furnished_status]}
          </span>
          {card.pet_friendly && (
            <span className="inline-flex items-center gap-1">
              <PawPrint className="size-3.5" />
              Pets OK
            </span>
          )}
        </div>
        <a
          href={`/properties/${card.id}`}
          target="_blank"
          rel="noopener noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          <ExternalLink className="size-3.5" />
          Full details
        </a>
      </div>
    </div>
  );
}
