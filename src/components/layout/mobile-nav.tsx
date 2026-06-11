"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MobileNav({
  links,
  signedIn,
}: {
  links: { href: string; label: string }[];
  signedIn: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X /> : <Menu />}
      </Button>
      {open && (
        <div className="absolute inset-x-0 top-16 z-50 border-b bg-background p-4 shadow-lg">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
            {!signedIn && (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Log in
              </Link>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
