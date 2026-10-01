import Link from "next/link";

import type { ReportTarget } from "@/types";

/**
 * Reports store only a bare target_id, so the admin list used to show eight
 * characters of a UUID and no way through. This resolves the id to whichever
 * detail page actually owns it.
 */
export function EntityLink({
  type,
  id,
  label,
}: {
  type: ReportTarget;
  id: string;
  label?: string;
}) {
  const href =
    type === "user" ? `/admin/users/${id}` : type === "property" ? `/admin/listings/${id}` : null;

  // Reviews have no detail page of their own — send the admin to the moderation
  // queue rather than render a dead link.
  const text = label ?? (type === "review" ? "View in review queue" : `${type} ${id.slice(0, 8)}`);

  if (!href) {
    return (
      <Link href="/admin/reviews" className="font-medium text-primary hover:underline">
        {text}
      </Link>
    );
  }
  return (
    <Link href={href} className="font-medium text-primary hover:underline">
      {text}
    </Link>
  );
}
