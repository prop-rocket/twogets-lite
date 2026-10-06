import { NextResponse } from "next/server";

import { toCsv } from "@/lib/csv";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  listAdminListings,
  listAdminReviews,
  listAdminUsers,
  listReports,
  listVerifications,
} from "@/server/admin-queries";

export const dynamic = "force-dynamic";

/** One page big enough to be a full export without being unbounded. */
const EXPORT_PAGE = 1;

const DATASETS = ["users", "listings", "reviews", "reports", "verifications"] as const;
type Dataset = (typeof DATASETS)[number];

function isDataset(v: string | null): v is Dataset {
  return v !== null && (DATASETS as readonly string[]).includes(v);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const dataset = new URL(request.url).searchParams.get("dataset");
  if (!isDataset(dataset)) {
    return NextResponse.json(
      { error: `dataset must be one of: ${DATASETS.join(", ")}` },
      { status: 400 },
    );
  }

  // Reuses the same paginated queries the list pages use, so an export can
  // never see more than the admin's own RLS allows.
  const rows = await (async (): Promise<Record<string, unknown>[]> => {
    switch (dataset) {
      case "users":
        return (await listAdminUsers({ page: EXPORT_PAGE })).rows as unknown as Record<
          string,
          unknown
        >[];
      case "listings":
        return (await listAdminListings({ page: EXPORT_PAGE })).rows as unknown as Record<
          string,
          unknown
        >[];
      case "reviews":
        return (await listAdminReviews({ page: EXPORT_PAGE })).rows as unknown as Record<
          string,
          unknown
        >[];
      case "reports":
        return (await listReports({ page: EXPORT_PAGE })).rows as unknown as Record<
          string,
          unknown
        >[];
      case "verifications":
        return (await listVerifications({ scope: "pending", page: EXPORT_PAGE }))
          .rows as unknown as Record<string, unknown>[];
    }
  })();

  // Drop embedded relations — they'd serialise as JSON blobs in a cell.
  const flat = rows.map((r) =>
    Object.fromEntries(Object.entries(r).filter(([, v]) => typeof v !== "object" || v === null)),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(flat), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="twogets-${dataset}-${stamp}.csv"`,
    },
  });
}
