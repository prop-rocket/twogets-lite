"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recordManualPayment } from "@/server/actions/payments";
import type { PlanRow } from "@/types";

/** Keys in a payment taken outside the platform until a gateway exists. */
export function RecordPaymentForm({ plans }: { plans: PlanRow[] }) {
  const router = useRouter();
  const [errors, setErrors] = React.useState<Record<string, string[]> | undefined>();

  async function action(formData: FormData) {
    const result = await recordManualPayment(formData);
    if (result.ok) {
      toast.success(result.message);
      setErrors(undefined);
      router.refresh();
    } else {
      setErrors(result.fieldErrors);
      toast.error(result.error);
    }
  }

  const field = "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="userId">Account ID</Label>
        <Input id="userId" name="userId" placeholder="UUID from the users list" required />
        {errors?.userId && <p className="text-xs text-destructive">{errors.userId[0]}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="planCode">Plan</Label>
          <select id="planCode" name="planCode" defaultValue="plus" className={field}>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amountRupees">Amount (₹)</Label>
          <Input id="amountRupees" name="amountRupees" type="number" min={0} step="1" required />
          {errors?.amountRupees && (
            <p className="text-xs text-destructive">{errors.amountRupees[0]}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="months">Months</Label>
          <Input id="months" name="months" type="number" min={1} max={36} defaultValue={1} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="method">How they paid</Label>
        <Input id="method" name="method" placeholder="UPI, bank transfer, cash…" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} placeholder="Reference number, who agreed it…" />
      </div>

      <SubmitButton>Record payment</SubmitButton>
    </form>
  );
}
