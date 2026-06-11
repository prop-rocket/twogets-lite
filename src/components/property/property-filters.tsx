"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FURNISHED_LABELS, SORT_OPTIONS } from "@/lib/constants";

const ANY = "any";

export function PropertyFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = React.useState(false);

  const get = (key: string) => searchParams.get(key) ?? "";
  const [q, setQ] = React.useState(get("q"));
  const [city, setCity] = React.useState(get("city"));
  const [minRent, setMinRent] = React.useState(get("minRent"));
  const [maxRent, setMaxRent] = React.useState(get("maxRent"));

  function apply(overrides: Record<string, string> = {}) {
    const params = new URLSearchParams(searchParams.toString());
    const values: Record<string, string> = {
      q,
      city,
      minRent,
      maxRent,
      ...overrides,
    };
    for (const [key, value] of Object.entries(values)) {
      if (value && value !== ANY) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page"); // any filter change resets pagination
    router.push(`${pathname}?${params.toString()}`);
  }

  function setParam(key: string, value: string) {
    apply({ [key]: value });
  }

  function clearAll() {
    setQ("");
    setCity("");
    setMinRent("");
    setMaxRent("");
    router.push(pathname);
  }

  const hasFilters = searchParams.toString().length > 0;

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, locality or keyword…"
            className="pl-9"
            aria-label="Search properties"
          />
        </div>
        <Input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className="sm:w-44"
          aria-label="City"
        />
        <Button type="submit">Search</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
        >
          <SlidersHorizontal />
          Filters
        </Button>
      </form>

      {showFilters && (
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>BHK</Label>
            <Select value={get("bhk") || ANY} onValueChange={(v) => setParam("bhk", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any</SelectItem>
                {[1, 2, 3].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} BHK
                  </SelectItem>
                ))}
                <SelectItem value="4">4+ BHK</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Furnishing</Label>
            <Select value={get("furnished") || ANY} onValueChange={(v) => setParam("furnished", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any</SelectItem>
                {Object.entries(FURNISHED_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Rent range (₹/mo)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                placeholder="Min"
                value={minRent}
                onChange={(e) => setMinRent(e.target.value)}
                onBlur={() => apply()}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                min={0}
                placeholder="Max"
                value={maxRent}
                onChange={(e) => setMaxRent(e.target.value)}
                onBlur={() => apply()}
              />
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={get("petFriendly") === "1"}
                onCheckedChange={(v) => setParam("petFriendly", v ? "1" : "")}
              />
              Pet friendly
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={get("verifiedOwner") === "1"}
                onCheckedChange={(v) => setParam("verifiedOwner", v ? "1" : "")}
              />
              Verified owner only
            </label>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <div className="flex items-center gap-2">
          <Label className="text-muted-foreground">Sort</Label>
          <Select value={get("sort") || "newest"} onValueChange={(v) => setParam("sort", v)}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X />
            Clear all
          </Button>
        )}
      </div>
    </div>
  );
}
