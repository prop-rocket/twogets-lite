"use client";

import Link from "next/link";
import { Check, Heart, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FREE_DAILY_RIGHT_SWIPES } from "@/lib/constants";

const PLUS_PERKS = [
  "Unlimited shortlists, every day",
  "Unlimited viewing requests",
  "Priority support",
];

export function UpgradeDialog({
  open,
  onOpenChange,
  signedIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signedIn: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" />
            You&apos;re on a roll!
          </DialogTitle>
          <DialogDescription>
            That&apos;s all {FREE_DAILY_RIGHT_SWIPES} free shortlists for today. Your shortlist and
            viewing requests stay fully available — and you get {FREE_DAILY_RIGHT_SWIPES} more
            tomorrow.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-secondary/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="accent">TwoGets Plus</Badge>
            <span className="text-sm text-muted-foreground">for serious home hunters</span>
          </div>
          <ul className="space-y-2">
            {PLUS_PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-sm">
                <Check className="size-4 shrink-0 text-primary" />
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <Button disabled className="w-full">
            <Sparkles />
            Upgrade to Plus — payments launching soon
          </Button>
          {signedIn && (
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/saved">
                <Heart />
                Schedule viewings from my shortlist
              </Link>
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Come back tomorrow
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
