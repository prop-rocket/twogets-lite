"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Confirmation gate for admin actions that are disruptive or user-visible
 * (banning someone, taking a listing down). The trigger is rendered as-is; the
 * action only runs once confirmed.
 */
export function ConfirmActionDialog({
  trigger,
  title,
  description,
  confirmLabel,
  variant = "default",
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "default" | "destructive";
  onConfirm: () => Promise<void> | void;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function confirm() {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant={variant} disabled={pending} onClick={confirm}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
