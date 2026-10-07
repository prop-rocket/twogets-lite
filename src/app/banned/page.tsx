import { ShieldAlert } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL } from "@/lib/constants";
import { logout } from "@/server/actions/auth";

export const metadata = { title: "Account restricted" };

export default function BannedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <div className="rounded-full bg-red-100 p-4">
        <ShieldAlert className="size-8 text-red-600" />
      </div>
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-bold">Your account has been restricted</h1>
        <p className="max-w-md text-muted-foreground">
          You can still sign in, but you can&apos;t browse homes, list a property or book
          viewings while the restriction is in place.
        </p>
        <p className="text-muted-foreground">
          Please contact our team at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          and we&apos;ll look into it.
        </p>
      </div>
      <form action={logout}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </div>
  );
}
