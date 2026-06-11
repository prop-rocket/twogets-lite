import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your TwoGets account to manage listings, viewings and verification.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground">Log in to pick up where you left off.</p>
      </div>
      {error === "oauth" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          Google sign-in failed. Please try again.
        </p>
      )}
      <LoginForm next={next} />
    </div>
  );
}
