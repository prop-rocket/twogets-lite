"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Radix Select can't hold an empty string, so "no filter" needs a sentinel. */
const ANY = "any";

export type AdminFilterField =
  | { type: "search"; key: string; placeholder: string }
  | {
      type: "select";
      key: string;
      label: string;
      options: { value: string; label: string }[];
    };

/**
 * Config-driven filter bar for the admin list pages. Writes straight to the
 * URL so the server component re-queries — filters, paging and deep links all
 * stay in one place (the query string).
 */
export function AdminFilterBar({ fields }: { fields: AdminFilterField[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchField = fields.find((f) => f.type === "search");
  const [term, setTerm] = React.useState(
    searchField ? (searchParams.get(searchField.key) ?? "") : "",
  );

  // Keep the box in sync when the URL changes from outside (e.g. Clear).
  React.useEffect(() => {
    if (searchField) setTerm(searchParams.get(searchField.key) ?? "");
  }, [searchParams, searchField]);

  function apply(overrides: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value && value !== ANY) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page"); // any filter change invalidates the current page
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const activeCount = fields.filter((f) => searchParams.get(f.key)).length;

  return (
    <div className="flex flex-wrap items-end gap-2">
      {fields.map((field) =>
        field.type === "search" ? (
          <form
            key={field.key}
            className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-xs"
            onSubmit={(e) => {
              e.preventDefault();
              apply({ [field.key]: term });
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={field.placeholder}
                className="pl-9"
                aria-label={field.placeholder}
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>
        ) : (
          <Select
            key={field.key}
            value={searchParams.get(field.key) ?? ANY}
            onValueChange={(value) => apply({ [field.key]: value })}
          >
            <SelectTrigger className="w-auto min-w-36" aria-label={field.label}>
              <SelectValue placeholder={field.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{field.label}: any</SelectItem>
              {field.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      )}

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTerm("");
            apply(Object.fromEntries(fields.map((f) => [f.key, ""])));
          }}
        >
          <X className="size-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
