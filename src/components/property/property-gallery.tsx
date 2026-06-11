"use client";

import * as React from "react";
import Image from "next/image";

import { cn, publicMediaUrl } from "@/lib/utils";
import type { PropertyImageRow } from "@/types";

export function PropertyGallery({
  images,
  title,
}: {
  images: PropertyImageRow[];
  title: string;
}) {
  const sorted = React.useMemo(
    () => [...images].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order),
    [images],
  );
  const [active, setActive] = React.useState(0);

  if (sorted.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed bg-secondary text-muted-foreground">
        Photos coming soon
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-secondary">
        <Image
          src={publicMediaUrl(sorted[active]!.storage_path)}
          alt={sorted[active]!.alt_text || `${title} — photo ${active + 1}`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 66vw"
          className="object-cover"
        />
      </div>
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                i === active ? "border-primary" : "border-transparent opacity-80 hover:opacity-100",
              )}
              aria-label={`Photo ${i + 1}`}
            >
              <Image
                src={publicMediaUrl(img.storage_path)}
                alt=""
                fill
                sizes="96px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
