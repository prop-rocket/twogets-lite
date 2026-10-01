"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { becomeHost, setMode } from "@/server/actions/mode";
import type { AppMode } from "@/lib/mode";

/**
 * Floating pill that flips between the renting and hosting sides of the app.
 * Someone who has never hosted gets the same control, which sets hosting up on
 * first use rather than hiding the capability behind a separate flow.
 */
export function ModeSwitcher({ mode, canHost }: { mode: AppMode; canHost: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const goHosting = mode === "travelling";
  const label = !goHosting
    ? "Switch to renting"
    : canHost
      ? "Switch to hosting"
      : "List your place";

  function run() {
    startTransition(async () => {
      const result =
        goHosting && !canHost
          ? await becomeHost()
          : await setMode(goHosting ? "hosting" : "travelling");

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.push(goHosting ? "/dashboard" : "/properties");
      router.refresh();
    });
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArrowLeftRight className="size-4" />
        )}
        {label}
      </button>
    </div>
  );
}
