import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  searchParams,
  basePath = "/properties",
}: {
  page: number;
  pageCount: number;
  searchParams: Record<string, string | string[] | undefined>;
  basePath?: string;
}) {
  if (pageCount <= 1) return null;

  function pageHref(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string" && key !== "page") params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const windowPages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => Math.abs(p - page) <= 2 || p === 1 || p === pageCount,
  );

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      <Link
        href={pageHref(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          page === 1 && "pointer-events-none opacity-50",
        )}
      >
        <ChevronLeft className="size-4" />
      </Link>
      {windowPages.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && windowPages[i - 1]! < p - 1 && (
            <span className="px-1 text-muted-foreground">…</span>
          )}
          <Link
            href={pageHref(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: p === page ? "default" : "ghost", size: "icon" }),
            )}
          >
            {p}
          </Link>
        </span>
      ))}
      <Link
        href={pageHref(Math.min(pageCount, page + 1))}
        aria-disabled={page === pageCount}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          page === pageCount && "pointer-events-none opacity-50",
        )}
      >
        <ChevronRight className="size-4" />
      </Link>
    </nav>
  );
}
