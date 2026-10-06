"use client";

import * as React from "react";
import { Ban, Check, Download, ExternalLink, Eye, EyeOff, ShieldCheck, Sparkles, X } from "lucide-react";
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
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import {
  adminCancelSlot,
  adminSetBookingStatus,
  adminSetListingStatus,
  confirmListingWithOwner,
  setUserRole,
  getDocumentSignedUrl,
  moderateReview,
  resolveReport,
  reviewVerification,
  setUserBanned,
  setUserPlan,
} from "@/server/actions/admin";
import type {
  PropertyStatus,
  ReportStatus,
  UserPlan,
  UserRole,
  ViewingBookingStatus,
} from "@/types";

export function ViewDocumentButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await getDocumentSignedUrl(requestId);
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

  async function run() {
    const result = await setUserBanned(userId, !isBanned);
    if (result.ok) toast.success(result.message);
    else toast.error(result.error);
  }

  // Unbanning is recoverable, so it stays one click; banning asks first.
  if (isBanned) {
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(run)}>
        <ShieldCheck />
        Unban
      </Button>
    );
  }

  return (
    <ConfirmActionDialog
      trigger={
        <Button size="sm" variant="destructive">
          <Ban />
          Ban
        </Button>
      }
      title="Ban this user?"
      description="They'll be locked out of their dashboard. Any listings they own stay published — take those down separately if that's needed."
      confirmLabel="Ban user"
      variant="destructive"
      onConfirm={run}
    />
  );
}

export function UserPlanButton({ userId, plan }: { userId: string; plan: UserPlan }) {
  const [pending, startTransition] = React.useTransition();
  const upgrade = plan !== "plus";
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setUserPlan(userId, upgrade ? "plus" : "free");
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      <Sparkles />
      {upgrade ? "Upgrade to Plus" : "Move to Free"}
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

  async function run() {
    const result = await adminSetListingStatus(propertyId, takeDown ? "archived" : "active");
    if (result.ok) toast.success(result.message);
    else toast.error(result.error);
  }

  if (!takeDown) {
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(run)}>
        Restore
      </Button>
    );
  }

  return (
    <ConfirmActionDialog
      trigger={
        <Button size="sm" variant="destructive">
          Take down
        </Button>
      }
      title="Take this listing down?"
      description="It will be archived and disappear from search, the swipe deck and its public page. The owner keeps it and you can restore it later."
      confirmLabel="Take down"
      variant="destructive"
      onConfirm={run}
    />
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

/** Records the phone call to the real owner for a listing they don't own. */
export function OwnerConfirmButton({
  propertyId,
  confirmed,
}: {
  propertyId: string;
  confirmed: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      size="sm"
      variant={confirmed ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await confirmListingWithOwner(propertyId, !confirmed);
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      <ShieldCheck />
      {confirmed ? "Undo owner confirmation" : "Confirmed with owner"}
    </Button>
  );
}

/** Promote or demote. The last-admin rule is enforced in the database. */
export function UserRoleButton({ userId, role }: { userId: string; role: UserRole | null }) {
  const [, startTransition] = React.useTransition();
  const makeAdmin = role !== "admin";

  function run() {
    startTransition(async () => {
      const result = await setUserRole(userId, makeAdmin ? "admin" : "tenant");
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <ConfirmActionDialog
      trigger={
        <Button size="sm" variant={makeAdmin ? "outline" : "destructive"}>
          <ShieldCheck />
          {makeAdmin ? "Make admin" : "Remove admin"}
        </Button>
      }
      title={makeAdmin ? "Grant admin access?" : "Remove admin access?"}
      description={
        makeAdmin
          ? "They'll be able to verify documents, ban accounts, moderate reviews and see everyone's data."
          : "They'll lose the admin panel and drop back to a normal renter account."
      }
      confirmLabel={makeAdmin ? "Make admin" : "Remove admin"}
      variant={makeAdmin ? "default" : "destructive"}
      onConfirm={run}
    />
  );
}

/** Admin override on a booking, for disputes the owner won't resolve. */
export function AdminBookingStatusSelect({
  bookingId,
  status,
  propertyId,
}: {
  bookingId: string;
  status: ViewingBookingStatus;
  propertyId: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const OPTIONS: ViewingBookingStatus[] = [
    "confirmed",
    "declined",
    "cancelled",
    "attended",
    "no_show",
  ];

  return (
    <select
      disabled={pending}
      value={status}
      aria-label="Override booking status"
      onChange={(e) =>
        startTransition(async () => {
          const result = await adminSetBookingStatus(
            bookingId,
            e.target.value as ViewingBookingStatus,
            propertyId,
          );
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
      className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
    >
      {OPTIONS.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Cancel a slot on the owner's behalf. */
export function AdminCancelSlotButton({
  slotId,
  propertyId,
}: {
  slotId: string;
  propertyId: string;
}) {
  return (
    <ConfirmActionDialog
      trigger={
        <Button size="sm" variant="destructive">
          Cancel slot
        </Button>
      }
      title="Cancel this viewing slot?"
      description="Everyone holding or awaiting a place on it is cancelled too. The owner is not asked first."
      confirmLabel="Cancel slot"
      variant="destructive"
      onConfirm={async () => {
        const result = await adminCancelSlot(slotId, propertyId);
        if (result.ok) toast.success(result.message);
        else toast.error(result.error);
      }}
    />
  );
}

/** Download the current dataset as CSV. */
export function ExportButton({ dataset }: { dataset: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      <a href={`/admin/export?dataset=${dataset}`} download>
        <Download />
        Export CSV
      </a>
    </Button>
  );
}
