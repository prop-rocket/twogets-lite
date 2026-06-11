import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2, Home } from "lucide-react";

import { SubmitButton } from "@/components/shared/submit-button";
import { getCurrentUser } from "@/lib/supabase/server";
import { selectRole } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Choose your role" };

const ROLES = [
  {
    value: "tenant",
    icon: Home,
    label: "I'm looking for a home",
    description: "Browse verified listings, save favourites and book viewings.",
  },
  {
    value: "homeowner",
    icon: Building2,
    label: "I'm a homeowner",
    description: "List your property and connect with verified tenants.",
  },
] as const;

export default async function RoleSelectionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold">How will you use TwoGets?</h1>
        <p className="text-muted-foreground">
          This sets up your dashboard — it can&apos;t be changed later.
        </p>
      </div>
      <div className="space-y-3">
        {ROLES.map((role) => (
          <form key={role.value} action={selectRole}>
            <input type="hidden" name="role" value={role.value} />
            <SubmitButton
              variant="outline"
              className="h-auto w-full justify-start gap-4 p-4 text-left"
            >
              <role.icon className="!size-6 text-primary" />
              <span className="flex flex-col items-start gap-0.5">
                <span className="font-display text-base font-semibold">{role.label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {role.description}
                </span>
              </span>
            </SubmitButton>
          </form>
        ))}
      </div>
    </div>
  );
}
