"use client";

import * as React from "react";
import { CalendarCheck } from "lucide-react";
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
import { requestViewing } from "@/server/actions/inquiries";

export function RequestViewingDialog({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function action(formData: FormData) {
    const result = await requestViewing(formData);
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
        <Button size="lg" className="w-full">
          <CalendarCheck />
          Request Viewing
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a viewing</DialogTitle>
          <DialogDescription>
            Pick a slot that works for you — the owner will confirm or suggest changes.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="propertyId" value={propertyId} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="preferredDate">Date</Label>
              <Input id="preferredDate" name="preferredDate" type="date" min={today} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preferredTime">Time</Label>
              <Input id="preferredTime" name="preferredTime" type="time" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">Message to the owner (optional)</Label>
            <Textarea
              id="message"
              name="message"
              placeholder="Introduce yourself — occupation, move-in timeline, who'll be staying…"
              maxLength={1000}
            />
          </div>
          <SubmitButton className="w-full">Send request</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
