import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  CalendarCheck,
  FileCheck2,
  Home,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
  Zap,
} from "lucide-react";

import { LogoIcon } from "@/components/brand/logo";
import { PropertyCard } from "@/components/property/property-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { POPULAR_CITIES } from "@/lib/constants";
import { getFeaturedProperties } from "@/server/queries";

export const revalidate = 300;

const TRUST_FEATURES = [
  {
    icon: BadgeCheck,
    title: "Verified Owner Badge",
    description: "Every owner proves ownership with utility bills, tax receipts or sale deeds before going live.",
  },
  {
    icon: UserCheck,
    title: "Verified Tenant Badge",
    description: "Tenants verify identity with Aadhaar and PAN, so owners know exactly who they're talking to.",
  },
  {
    icon: ShieldCheck,
    title: "Trust Scores",
    description: "A transparent 0–100 score built from verification status and real community reviews.",
  },
  {
    icon: Star,
    title: "Two-way Reviews",
    description: "Tenants rate communication, deposit fairness and accuracy. Owners rate reliability and care.",
  },
];

const HOW_IT_WORKS = [
  {
    icon: Search,
    step: "01",
    title: "Discover",
    description: "Filter verified homes by city, BHK, budget, furnishing and pet policy.",
  },
  {
    icon: FileCheck2,
    step: "02",
    title: "Get Verified",
    description: "Upload your documents once. Earn the badge that owners and tenants trust.",
  },
  {
    icon: CalendarCheck,
    step: "03",
    title: "Book a Viewing",
    description: "Request a slot in one tap. Owners accept and your appointment is scheduled instantly.",
  },
  {
    icon: Zap,
    step: "04",
    title: "Move In",
    description: "Agree directly with the owner — no brokers, no hidden fees, no surprises.",
  },
];

export default async function LandingPage() {
  const featured = await getFeaturedProperties(6);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="pointer-events-none absolute -right-24 -top-24 opacity-10">
          <LogoIcon className="h-[28rem] w-[28rem]" house="#FFFFFF" bolt="#FFFFFF" />
        </div>
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="max-w-2xl space-y-6">
            <Badge variant="accent" className="px-3 py-1 text-sm">
              <Sparkles className="size-4" />
              Trust-first rental marketplace
            </Badge>
            <h1 className="font-display text-5xl font-bold leading-[1.05] md:text-6xl">
              Home rental made instant.
              <span className="block text-accent">Get your place, get moving.</span>
            </h1>
            <p className="max-w-xl text-lg text-primary-foreground/85">
              TwoGets connects verified homeowners directly with verified tenants. Real documents,
              real reviews, real trust — and zero brokerage.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="accent" className="font-bold">
                <Link href="/properties">
                  <Search />
                  Browse Verified Homes
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/signup?role=homeowner">
                  <Building2 />
                  List Your Property
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {POPULAR_CITIES.slice(0, 6).map((city) => (
                <Link
                  key={city}
                  href={`/properties?city=${encodeURIComponent(city)}`}
                  className="rounded-full border border-white/25 px-3 py-1 text-sm text-primary-foreground/85 transition-colors hover:bg-white/10"
                >
                  {city}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="container mx-auto scroll-mt-20 px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="font-display text-4xl font-bold">How TwoGets works</h2>
          <p className="mt-2 text-lg text-muted-foreground">
            Speed, security, simplicity — from search to move-in.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((item) => (
            <Card key={item.step} className="relative overflow-hidden">
              <CardContent className="space-y-3 p-6">
                <span className="font-display text-5xl font-bold text-primary/10">{item.step}</span>
                <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10">
                  <item.icon className="size-5 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FEATURED LISTINGS */}
      {featured.length > 0 && (
        <section className="bg-muted/50 py-20">
          <div className="container mx-auto px-4">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <h2 className="font-display text-4xl font-bold">Featured homes</h2>
                <p className="mt-2 text-lg text-muted-foreground">
                  Verified listings from trusted owners.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/properties">View all</Link>
              </Button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TRUST */}
      <section id="trust" className="container mx-auto scroll-mt-20 px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="font-display text-4xl font-bold">Built on trust, not listings volume</h2>
          <p className="mx-auto mt-2 max-w-2xl text-lg text-muted-foreground">
            Every badge on TwoGets is backed by a real document review and every score by real
            interactions — so both sides can commit with confidence.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_FEATURES.map((feature) => (
            <div key={feature.title} className="space-y-3 rounded-xl border p-6">
              <div className="flex size-11 items-center justify-center rounded-lg bg-accent/15">
                <feature.icon className="size-5 text-accent" />
              </div>
              <h3 className="font-display text-xl font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-20">
        <div className="relative overflow-hidden rounded-2xl bg-foreground px-8 py-14 text-center text-background">
          <div className="pointer-events-none absolute -left-10 -top-10 opacity-10">
            <LogoIcon className="h-64 w-64" house="#FFFFFF" />
          </div>
          <h2 className="font-display text-4xl font-bold">Ready to get your place?</h2>
          <p className="mx-auto mt-3 max-w-xl text-background/70">
            Join thousands of verified renters and owners who skip the brokers and rent with
            confidence.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="accent" className="font-bold">
              <Link href="/signup?role=tenant">
                <Home />
                I&apos;m looking for a home
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup?role=homeowner">
                <Building2 />
                I&apos;m a homeowner
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
