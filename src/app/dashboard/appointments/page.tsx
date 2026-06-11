import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { AppointmentActions } from "@/components/appointment/appointment-actions";
import { ReviewDialog } from "@/components/review/review-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/utils";
import type { AppointmentStatus, AppointmentWithRelations } from "@/types";

export const metadata = { title: "Appointments" };

const STATUS_VARIANT: Record<AppointmentStatus, "warning" | "success" | "destructive" | "secondary"> = {
  scheduled: "warning",
  completed: "success",
  cancelled: "secondary",
  no_show: "destructive",
};

export default async function AppointmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isOwner = user.role === "homeowner";

  const supabase = await createClient();
  const [{ data }, { data: myReviews }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        `*,
         property:properties(id, title, locality, city),
         tenant:users!appointments_tenant_id_fkey(id, full_name, avatar_url, is_verified, trust_score, role, created_at),
         owner:users!appointments_owner_id_fkey(id, full_name, avatar_url, is_verified, trust_score, role, created_at)`,
      )
      .eq(isOwner ? "owner_id" : "tenant_id", user.id)
      .order("scheduled_date", { ascending: false }),
    supabase.from("reviews").select("appointment_id").eq("reviewer_id", user.id),
  ]);

  const appointments = (data ?? []) as unknown as AppointmentWithRelations[];
  const reviewedAppointments = new Set((myReviews ?? []).map((r) => r.appointment_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Appointments</h1>
        <p className="text-muted-foreground">
          Confirmed viewings. After a completed viewing, both sides can review each other.
        </p>
      </div>

      {appointments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No appointments yet"
          description="Accepted viewing requests appear here automatically."
        />
      ) : (
        <div className="space-y-4">
          {appointments.map((appointment) => {
            const counterpart = isOwner ? appointment.tenant : appointment.owner;
            return (
              <Card key={appointment.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-lg font-semibold">
                      {formatDate(appointment.scheduled_date)} at{" "}
                      {formatTime(appointment.scheduled_time)}
                    </p>
                    <Badge variant={STATUS_VARIANT[appointment.status]}>
                      {APPOINTMENT_STATUS_LABELS[appointment.status]}
                    </Badge>
                  </div>

                  <p className="text-sm">
                    <Link
                      href={`/properties/${appointment.property.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {appointment.property.title}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      — {appointment.property.locality}, {appointment.property.city} · with{" "}
                      {counterpart.full_name}
                    </span>
                  </p>

                  {appointment.status === "scheduled" && (
                    <AppointmentActions appointmentId={appointment.id} isOwner={isOwner} />
                  )}

                  {appointment.status === "completed" &&
                    (reviewedAppointments.has(appointment.id) ? (
                      <p className="text-sm text-muted-foreground">
                        ✓ You reviewed this viewing.
                      </p>
                    ) : (
                      <ReviewDialog
                        appointmentId={appointment.id}
                        reviewType={isOwner ? "tenant_review" : "owner_review"}
                        revieweeName={counterpart.full_name}
                      />
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
