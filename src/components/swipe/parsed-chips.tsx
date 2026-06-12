"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PencilLine, X } from "lucide-react";

import { parsedToChips, parsedToQuery, type ParsedSearch } from "@/lib/nl-search";

/**
 * The parser's understanding of the search, shown as removable chips so a
 * misparse is a one-tap fix instead of a retype.
 */
export function ParsedChips({ parsed }: { parsed: ParsedSearch }) {
  const router = useRouter();
  const chips = parsedToChips(parsed);

  function removeChip(key: keyof ParsedSearch) {
    const next: ParsedSearch = { ...parsed };
    if (key === "bhk") next.bhk = [];
    else if (key === "petFriendly" || key === "verifiedOnly") next[key] = false;
    else if (key === "maxRent") {
      next.maxRent = null;
      next.minRent = null; // chip shows the whole range
    } else {
      next[key] = null as never;
    }
    const q = parsedToQuery(next);
    router.push(q ? `/swipe?q=${encodeURIComponent(q)}` : "/swipe");
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground"
        >
          {chip.label}
          <button
            type="button"
            aria-label={`Remove ${chip.label}`}
            onClick={() => removeChip(chip.key)}
            className="rounded-full p-0.5 hover:bg-primary/10"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Link
        href="/swipe"
        className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <PencilLine className="size-3" />
        New search
      </Link>
    </div>
  );
}
