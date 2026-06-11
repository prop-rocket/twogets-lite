"use client";

import * as React from "react";
import { Flag } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/shared/submit-button";
import { submitReport } from "@/server/actions/reviews";
import type { ReportTarget } from "@/types";

export function ReportDialog({
  targetType,
  targetId,
}: {
  targetType: ReportTarget;
  targetId: string;
}) {
  const [open, setOpen] = React.useState(false);

  async function action(formData: FormData) {
    const result = await submitReport(formData);
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
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this {targetType}</DialogTitle>
          <DialogDescription>
            Our moderation team reviews every report. False reports may affect your account.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              name="reason"
              placeholder="e.g. Fake listing, misleading photos…"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="details">Details (optional)</Label>
            <Textarea id="details" name="details" maxLength={2000} />
          </div>
          <SubmitButton variant="destructive" className="w-full">
            Submit report
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
