import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";

import { OwnerInquiryActions, TenantInquiryActions } from "@/components/inquiry/inquiry-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { TrustScore } from "@/components/shared/trust-score";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { INQUIRY_STATUS_LABELS } from "@/lib/constants";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { avatarUrl, formatDate, formatTime, initials } from "@/lib/utils";
import type { InquiryStatus, InquiryWithRelations } from "@/types";

export const metadata = { title: "Viewing Requests" };

const STATUS_VARIANT: Record<InquiryStatus, "warning" | "success" | "destructive" | "secondary"> = {
  pending: "warning",
  accepted: "success",
  rejected: "destructive",
  cancelled: "secondary",
};

export default async function InquiriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isOwner = user.role === "homeowner";

  const supabase = await createClient();
  const { data } = await supabase
    .from("inquiries")
    .select(
      `*,
       property:properties(id, title, locality, city, rent),
       tenant:users!inquiries_tenant_id_fkey(id, full_name, avatar_url, is_verified, trust_score, role, created_at),
       owner:users!inquiries_owner_id_fkey(id, full_name, avatar_url, is_verified, trust_score, role, created_at)`,
    )
    .eq(isOwner ? "owner_id" : "tenant_id", user.id)
    .order("created_at", { ascending: false });

  const inquiries = (data ?? []) as unknown as InquiryWithRelations[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Viewing requests</h1>
        <p className="text-muted-foreground">
          {isOwner
            ? "Tenants who want to see your properties. Accepting schedules the appointment automatically."
            : "Your requests to view homes."}
        </p>
      </div>

      {inquiries.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No viewing requests yet"
          description={
            isOwner
              ? "When tenants request a viewing on your listings, they'll show up here."
              : "Find a home you like and request a viewing — owners typically reply within hours."
          }
        />
      ) : (
        <div className="space-y-4">
          {inquiries.map((inquiry) => {
            const counterpart = isOwner ? inquiry.tenant : inquiry.owner;
            return (
              <Card key={inquiry.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage
                          src={avatarUrl(counterpart.avatar_url) ?? undefined}
                          alt={counterpart.full_name}
                        />
                        <AvatarFallback>{initials(counterpart.full_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          {counterpart.full_name}
                          {counterpart.is_verified && (
                            <VerifiedBadge kind={isOwner ? "tenant" : "owner"} />
                          )}
                        </p>
                        <TrustScore score={Number(counterpart.trust_score)} className="text-xs" />
                      </div>
                    </div>
                    <Badge variant={STATUS_VARIANT[inquiry.status]}>
                      {INQUIRY_STATUS_LABELS[inquiry.status]}
                    </Badge>
                  </div>

                  <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <Link
                      href={`/properties/${inquiry.property.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {inquiry.property.title}
                    </Link>
                    <span className="text-muted-foreground">
                      {" "}
                      — {inquiry.property.locality}, {inquiry.property.city}
                    </span>
                  </div>

                  <p className="text-sm">
                    <span className="text-muted-foreground">Requested slot:</span>{" "}
                    <strong>
                      {formatDate(inquiry.preferred_date)} at {formatTime(inquiry.preferred_time)}
                    </strong>
                  </p>

                  {inquiry.message && (
                    <p className="text-sm italic text-muted-foreground">“{inquiry.message}”</p>
                  )}

                  {inquiry.status === "pending" &&
                    (isOwner ? (
                      <OwnerInquiryActions inquiryId={inquiry.id} />
                    ) : (
                      <TenantInquiryActions inquiryId={inquiry.id} />
                    ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
