import Link from "next/link";

import { LogoIcon } from "@/components/brand/logo";
import { APP_TAGLINE } from "@/lib/constants";

const COLUMNS = [
  {
    title: "Renters",
    links: [
      { href: "/properties", label: "Browse Homes" },
      { href: "/signup?role=tenant", label: "Create Tenant Profile" },
      { href: "/dashboard/verification", label: "Get Verified" },
    ],
  },
  {
    title: "Homeowners",
    links: [
      { href: "/signup?role=homeowner", label: "List Your Property" },
      { href: "/dashboard/verification", label: "Verify Ownership" },
      { href: "/#trust", label: "Trust & Safety" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/#how-it-works", label: "How It Works" },
      { href: "/#trust", label: "Trust Features" },
      { href: "/properties", label: "Explore Cities" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-foreground text-background">
      <div className="container mx-auto grid gap-10 px-4 py-12 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LogoIcon house="#FFFFFF" className="h-9 w-9" />
            <span className="font-display text-2xl font-bold">TwoGets</span>
          </div>
          <p className="max-w-xs text-sm text-background/70">{APP_TAGLINE}</p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-background/60">
              {col.title}
            </h4>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-background/80 transition-colors hover:text-background"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-background/10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-background/60 sm:flex-row">
          <p>© {new Date().getFullYear()} TwoGets. All rights reserved.</p>
          <p>Speed · Security · Simplicity · Community</p>
        </div>
      </div>
    </footer>
  );
}
