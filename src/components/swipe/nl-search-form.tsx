"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLES = [
  "2 or 3 BHK in Indiranagar under ₹35k, pet friendly",
  "Furnished studio in Mumbai below 25k for bachelors",
  "Family villa in Whitefield, 40k to 60k",
];

export function NLSearchForm({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(initialQuery);

  function go(q: string) {
    const trimmed = q.trim();
    if (trimmed) router.push(`/swipe?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        className="space-y-3"
      >
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              go(value);
            }
          }}
          placeholder="Describe your dream home — e.g. “2 BHK in HSR Layout under ₹30,000, semi furnished, pet friendly”"
          rows={3}
          className="resize-none text-base"
          autoFocus
        />
        <Button type="submit" size="lg" className="w-full font-bold" disabled={!value.trim()}>
          <Search />
          Find my home
        </Button>
      </form>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Sparkles className="size-3.5" />
          Try one of these
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => go(example)}
              className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
