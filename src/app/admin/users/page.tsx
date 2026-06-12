import { BanUserButton, UserPlanButton } from "@/components/admin/admin-actions";
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
import { createClient } from "@/lib/supabase/server";
import { avatarUrl, formatDate, initials } from "@/lib/utils";

export const metadata = { title: "Manage Users" };

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">Most recent 200 accounts.</p>
      </div>

      <div className="rounded-xl border">
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
            {(users ?? []).map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={avatarUrl(user.avatar_url) ?? undefined} alt="" />
                      <AvatarFallback>{initials(user.full_name || user.email)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{user.full_name || "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
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
                  {user.role !== "admin" && (
                    <div className="flex justify-end gap-2">
                      {user.role === "tenant" && (
                        <UserPlanButton userId={user.id} plan={user.plan ?? "free"} />
                      )}
                      <BanUserButton userId={user.id} isBanned={user.is_banned} />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
