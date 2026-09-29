import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { BanUserButton, UserPlanButton } from "@/components/admin/admin-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { TrustScore } from "@/components/shared/trust-score";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { avatarUrl, formatDate, initials } from "@/lib/utils";
import { listAdminUsers } from "@/server/admin-queries";
import type { UserPlan, UserRole, UserRow } from "@/types";
import { Users as UsersIcon } from "lucide-react";

export const metadata = { title: "Manage Users" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
const bool = (v: string | string[] | undefined) =>
  v === "yes" ? true : v === "no" ? false : undefined;

const FILTERS = [
  { type: "search" as const, key: "q", placeholder: "Search name, email or phone" },
  {
    type: "select" as const,
    key: "role",
    label: "Role",
    options: [
      { value: "tenant", label: "Tenant" },
      { value: "homeowner", label: "Homeowner" },
      { value: "admin", label: "Admin" },
    ],
  },
  {
    type: "select" as const,
    key: "plan",
    label: "Plan",
    options: [
      { value: "free", label: "Free" },
      { value: "plus", label: "Plus" },
    ],
  },
  {
    type: "select" as const,
    key: "verified",
    label: "Verified",
    options: [
      { value: "yes", label: "Verified" },
      { value: "no", label: "Unverified" },
    ],
  },
  {
    type: "select" as const,
    key: "banned",
    label: "Status",
    options: [
      { value: "yes", label: "Banned" },
      { value: "no", label: "Active" },
    ],
  },
];

function UserActions({ user }: { user: UserRow }) {
  if (user.role === "admin") return null;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {user.role === "tenant" && <UserPlanButton userId={user.id} plan={user.plan ?? "free"} />}
      <BanUserButton userId={user.id} isBanned={user.is_banned} />
    </div>
  );
}

function Identity({ user }: { user: UserRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={avatarUrl(user.avatar_url) ?? undefined} alt="" />
        <AvatarFallback>{initials(user.full_name || user.email)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium">{user.full_name || "—"}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
    </div>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { rows, total, page, pageCount } = await listAdminUsers({
    q: str(params.q),
    role: str(params.role) as UserRole | undefined,
    plan: str(params.plan) as UserPlan | undefined,
    verified: bool(params.verified),
    banned: bool(params.banned),
    page: Number(str(params.page) ?? 1),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">
          {total} {total === 1 ? "account" : "accounts"} match these filters.
        </p>
      </div>

      <AdminFilterBar fields={FILTERS} />

      {rows.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No users match these filters"
          description="Try clearing the search or widening the filters."
        />
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trust</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Identity user={user} />
                    </TableCell>
                    <TableCell className="capitalize">{user.role ?? "—"}</TableCell>
                    <TableCell>
                      {(user.plan ?? "free") === "plus" ? (
                        <Badge variant="accent">Plus</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">Free</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.is_verified && <VerifiedBadge />}
                        {user.is_banned && <Badge variant="destructive">Banned</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <TrustScore score={Number(user.trust_score)} className="text-xs" />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <UserActions user={user} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((user) => (
              <div key={user.id} className="space-y-3 rounded-xl border p-4">
                <Identity user={user} />
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="capitalize">
                    {user.role ?? "—"}
                  </Badge>
                  {(user.plan ?? "free") === "plus" && <Badge variant="accent">Plus</Badge>}
                  {user.is_verified && <VerifiedBadge />}
                  {user.is_banned && <Badge variant="destructive">Banned</Badge>}
                  <span className="ml-auto">{formatDate(user.created_at)}</span>
                </div>
                <UserActions user={user} />
              </div>
            ))}
          </div>
        </>
      )}

      <Pagination page={page} pageCount={pageCount} searchParams={params} basePath="/admin/users" />
    </div>
  );
}
