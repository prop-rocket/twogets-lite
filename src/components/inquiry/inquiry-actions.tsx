"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cancelInquiry, respondToInquiry } from "@/server/actions/inquiries";

export function OwnerInquiryActions({ inquiryId }: { inquiryId: string }) {
  const [pending, startTransition] = React.useTransition();

  function respond(decision: "accepted" | "rejected") {
    startTransition(async () => {
      const result = await respondToInquiry(inquiryId, decision);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => respond("accepted")}>
        <Check />
        Accept
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => respond("rejected")}>
        <X />
        Decline
      </Button>
    </div>
  );
}

export function TenantInquiryActions({ inquiryId }: { inquiryId: string }) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await cancelInquiry(inquiryId);
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      <X />
      Cancel request
    </Button>
  );
}
