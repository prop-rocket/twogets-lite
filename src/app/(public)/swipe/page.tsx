import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Heart, Home, Search, Zap } from "lucide-react";

import { NLSearchForm } from "@/components/swipe/nl-search-form";
import { ParsedChips } from "@/components/swipe/parsed-chips";
import { SwipeDeck } from "@/components/swipe/swipe-deck";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { parseSearchQuery } from "@/lib/nl-search";
import { getCurrentUser } from "@/lib/supabase/server";
import { getSwipeDeck, getSwipeQuota, getSwipedPropertyIds } from "@/server/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Swipe to Find Your Home",
  description:
    "Describe your dream rental in plain words — TwoGets shortlists verified homes you can swipe through and book viewings in one tap.",
};

const STEPS = [
  { icon: Search, text: "Describe what you need, in your own words" },
  { icon: Heart, text: "Swipe right on homes you love" },
  { icon: Zap, text: "Book viewings in one tap — owners confirm fast" },
];

export default async function SwipePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const user = await getCurrentUser();

  // Owners and admins don't swipe — their side of the marketplace is the dashboard.
  if (user?.role === "homeowner" || user?.role === "admin") {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="space-y-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="size-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Swiping is for tenants</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {user.role === "homeowner"
                  ? "Your listings appear as cards in tenants' decks — keep them verified and photographed to win more right swipes."
                  : "Admin accounts moderate the marketplace rather than browse it."}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link href={user.role === "homeowner" ? "/dashboard/listings" : "/admin"}>
                  {user.role === "homeowner" ? "Manage my listings" : "Open admin panel"}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/properties">Browse the grid instead</Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Signed in but role not chosen yet (OAuth signup) — finish onboarding first.
  if (user && !user.role) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="space-y-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Home className="size-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">One quick step</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Tell us whether you&apos;re renting or listing, and the deck is yours.
              </p>
            </div>
            <Button asChild className="w-full">
              <Link href="/onboarding/role">Choose my role</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const query = q?.trim();
  const isTenant = user?.role === "tenant";

  // Step 1 — describe the home.
  if (!query) {
    return (
      <div className="container mx-auto max-w-xl space-y-10 px-4 py-12 md:py-16">
        <div className="space-y-3 text-center">
          <h1 className="font-display text-4xl font-bold">
            Find your home in <span className="text-primary">three swipes</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Tell us what you&apos;re looking for — location, BHK, budget, anything. We&apos;ll line
            up verified homes you can swipe through.
          </p>
        </div>

        <NLSearchForm />

        <div className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4 text-center">
                <div className="mx-auto flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <step.icon className="size-4 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">{step.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Step 2 — parse, search, deal the deck.
  const parsed = parseSearchQuery(query);
  const [excludeIds, remaining] = await Promise.all([
    isTenant && user ? getSwipedPropertyIds(user.id) : Promise.resolve([]),
    isTenant ? getSwipeQuota(user) : Promise.resolve(null),
  ]);
  const cards = await getSwipeDeck(parsed, excludeIds);

  return (
    <div className="container mx-auto max-w-xl space-y-5 px-4 py-8">
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          {cards.length
            ? `${cards.length} ${cards.length === 1 ? "home" : "homes"} lined up for you`
            : "Here's what we understood:"}
        </p>
        <ParsedChips parsed={parsed} />
      </div>

      <SwipeDeck
        initialCards={cards}
        initialRemaining={remaining}
        isTenant={Boolean(isTenant)}
        signedIn={Boolean(user)}
        query={query}
      />
    </div>
  );
}
