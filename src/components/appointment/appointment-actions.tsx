"use client";

import * as React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { updateAppointment } from "@/server/actions/inquiries";
import type { AppointmentStatus } from "@/types";

export function AppointmentActions({
  appointmentId,
  isOwner,
}: {
  appointmentId: string;
  isOwner: boolean;
}) {
  const [pending, startTransition] = React.useTransition();

  function setStatus(status: AppointmentStatus) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("appointmentId", appointmentId);
      formData.set("status", status);
      const result = await updateAppointment(formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {isOwner && (
        <>
          <Button size="sm" disabled={pending} onClick={() => setStatus("completed")}>
            <CheckCircle2 />
            Mark completed
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus("no_show")}>
            No-show
          </Button>
        </>
      )}
      <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus("cancelled")}>
        <XCircle />
        Cancel
      </Button>
    </div>
  );
}
