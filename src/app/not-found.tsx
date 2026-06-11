import Link from "next/link";

import { LogoIcon } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <LogoIcon className="h-16 w-16 opacity-40" />
      <div className="space-y-2">
        <h1 className="font-display text-5xl font-bold text-primary">404</h1>
        <p className="text-lg text-muted-foreground">
          This page moved out. Let&apos;s find you a new place.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/properties">Browse listings</Link>
        </Button>
      </div>
    </div>
  );
}
