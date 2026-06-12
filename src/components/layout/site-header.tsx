import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { UserNav } from "@/components/layout/user-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getCurrentUser } from "@/lib/supabase/server";

const NAV_LINKS = [
  { href: "/swipe", label: "Swipe to Find" },
  { href: "/properties", label: "Browse Homes" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#trust", label: "Trust & Safety" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {user.role === "homeowner" && (
                <Button asChild variant="accent" size="sm" className="hidden sm:inline-flex">
                  <Link href="/dashboard/listings/new">List Your Property</Link>
                </Button>
              )}
              <UserNav user={user} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Get Started</Link>
              </Button>
            </>
          )}
          <MobileNav links={NAV_LINKS} signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}
