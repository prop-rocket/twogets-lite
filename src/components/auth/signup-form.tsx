"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, Home } from "lucide-react";

import { FieldError } from "@/components/auth/field-error";
import { GoogleButton } from "@/components/auth/google-button";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signup } from "@/server/actions/auth";
import { cn } from "@/lib/utils";
import type { ActionResult, UserRole } from "@/types";

const ROLES: { value: Exclude<UserRole, "admin">; label: string; description: string; icon: typeof Home }[] = [
  { value: "tenant", label: "I'm a Tenant", description: "Find a verified home", icon: Home },
  { value: "homeowner", label: "I'm a Homeowner", description: "List & rent my property", icon: Building2 },
];

export function SignupForm({ defaultRole }: { defaultRole?: string }) {
  const [role, setRole] = React.useState<string>(
    defaultRole === "homeowner" ? "homeowner" : "tenant",
  );
  const [state, formAction] = React.useActionState(
    async (_prev: ActionResult | null, formData: FormData) => signup(formData),
    null,
  );

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="role" value={role} />
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account type">
          {ROLES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={role === option.value}
              onClick={() => setRole(option.value)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-colors",
                role === option.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <option.icon className="size-5 text-primary" />
              <span className="font-semibold">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required />
          <FieldError errors={state && !state.ok ? state.fieldErrors?.fullName : undefined} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          <FieldError errors={state && !state.ok ? state.fieldErrors?.email : undefined} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <FieldError errors={state && !state.ok ? state.fieldErrors?.password : undefined} />
        </div>
        {state && !state.ok && !state.fieldErrors && (
          <p className="text-sm font-medium text-destructive">{state.error}</p>
        )}
        <SubmitButton className="w-full">Create account</SubmitButton>
      </form>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>
      <GoogleButton label="Sign up with Google" />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
