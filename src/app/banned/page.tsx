import { ShieldAlert } from "lucide-react";

import { Logo } from "@/components/brand/logo";

export const metadata = { title: "Account suspended" };

export default function BannedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <div className="rounded-full bg-red-100 p-4">
        <ShieldAlert className="size-8 text-red-600" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold">Your account is suspended</h1>
        <p className="max-w-md text-muted-foreground">
          Your TwoGets account has been suspended for violating our trust & safety guidelines. If
          you believe this is a mistake, contact support.
        </p>
      </div>
    </div>
  );
}
