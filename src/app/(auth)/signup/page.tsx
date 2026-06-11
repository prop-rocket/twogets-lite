import type { Metadata } from "next";

import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Join TwoGets as a verified tenant or homeowner and rent with confidence — no brokers, no surprises.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold">Create your account</h1>
        <p className="text-muted-foreground">Get verified once, rent with trust everywhere.</p>
      </div>
      <SignupForm defaultRole={role} />
    </div>
  );
}
