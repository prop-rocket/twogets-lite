"use client";

import * as React from "react";
import Link from "next/link";

import { FieldError } from "@/components/auth/field-error";
import { GoogleButton } from "@/components/auth/google-button";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { login } from "@/server/actions/auth";
import type { ActionResult } from "@/types";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = React.useActionState(
    async (_prev: ActionResult | null, formData: FormData) => login(formData),
    null,
  );

  return (
    <div className="space-y-5">
      <GoogleButton next={next} />
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase text-muted-foreground">or with email</span>
        <Separator className="flex-1" />
      </div>

      <form action={formAction} className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
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
            autoComplete="current-password"
            required
          />
          <FieldError errors={state && !state.ok ? state.fieldErrors?.password : undefined} />
        </div>
        {state && !state.ok && !state.fieldErrors && (
          <p className="text-sm font-medium text-destructive">{state.error}</p>
        )}
        <SubmitButton className="w-full">Log in</SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to TwoGets?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
