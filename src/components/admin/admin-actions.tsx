"use client";

import * as React from "react";
import { Ban, Check, ExternalLink, Eye, EyeOff, ShieldCheck, X } from "lucide-react";
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
import { SubmitButton } from "@/components/shared/submit-button";
import {
  adminSetListingStatus,
  getDocumentSignedUrl,
  moderateReview,
  resolveReport,
  reviewVerification,
  setUserBanned,
} from "@/server/actions/admin";
import type { PropertyStatus, ReportStatus } from "@/types";

export function ViewDocumentButton({ storagePath }: { storagePath: string }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await getDocumentSignedUrl(storagePath);
          if (result.ok && result.data) window.open(result.data.url, "_blank", "noopener");
          else if (!result.ok) toast.error(result.error);
        })
      }
    >
      <ExternalLink />
      View document
    </Button>
  );
}

export function VerificationReviewActions({ requestId }: { requestId: string }) {
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function approve() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("requestId", requestId);
      formData.set("decision", "approved");
      const result = await reviewVerification(formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  async function reject(formData: FormData) {
    formData.set("requestId", requestId);
    formData.set("decision", "rejected");
    const result = await reviewVerification(formData);
    if (result.ok) {
      toast.success(result.message);
      setRejectOpen(false);
    } else toast.error(result.error);
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={approve}>
        <Check />
        Approve
      </Button>
      <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
        <X />
        Reject
      </Button>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject document</DialogTitle>
            <DialogDescription>The reason is shown to the user so they can fix it.</DialogDescription>
          </DialogHeader>
          <form action={reject} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rejectionReason">Reason</Label>
              <Input
                id="rejectionReason"
                name="rejectionReason"
                placeholder="e.g. Document is blurry / name doesn't match"
                required
              />
            </div>
            <SubmitButton variant="destructive" className="w-full">
              Reject document
            </SubmitButton>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function BanUserButton({ userId, isBanned }: { userId: string; isBanned: boolean }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      size="sm"
      variant={isBanned ? "outline" : "destructive"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setUserBanned(userId, !isBanned);
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      {isBanned ? <ShieldCheck /> : <Ban />}
      {isBanned ? "Unban" : "Ban"}
    </Button>
  );
}

export function AdminListingStatusButton({
  propertyId,
  status,
}: {
  propertyId: string;
  status: PropertyStatus;
}) {
  const [pending, startTransition] = React.useTransition();
  const takeDown = status === "active";
  return (
    <Button
      size="sm"
      variant={takeDown ? "destructive" : "outline"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await adminSetListingStatus(propertyId, takeDown ? "archived" : "active");
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      {takeDown ? "Take down" : "Restore"}
    </Button>
  );
}

export function ModerateReviewButton({
  reviewId,
  isApproved,
}: {
  reviewId: string;
  isApproved: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await moderateReview(reviewId, !isApproved);
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      {isApproved ? <EyeOff /> : <Eye />}
      {isApproved ? "Hide" : "Show"}
    </Button>
  );
}

export function ReportActions({ reportId }: { reportId: string }) {
  const [pending, startTransition] = React.useTransition();

  function update(status: ReportStatus) {
    startTransition(async () => {
      const result = await resolveReport(reportId, status);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => update("resolved")}>
        <Check />
        Resolve
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => update("dismissed")}>
        <X />
        Dismiss
      </Button>
    </div>
  );
}
