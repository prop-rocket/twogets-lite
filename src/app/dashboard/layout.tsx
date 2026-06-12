import { redirect } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Heart,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import type { ReactElement } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { SidebarNav, type SidebarItem } from "@/components/layout/sidebar-nav";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  if (!user.role) redirect("/onboarding/role");
  if (user.is_banned) redirect("/banned");
  if (user.role === "admin") redirect("/admin");

  const items: SidebarItem[] = [
    { href: "/dashboard", label: "Overview", icon: <LayoutDashboard className="size-4" />, exact: true },
    { href: "/dashboard/profile", label: "Profile", icon: <UserRound className="size-4" /> },
    { href: "/dashboard/verification", label: "Verification", icon: <ShieldCheck className="size-4" /> },
    ...(user.role === "tenant"
      ? [{ href: "/dashboard/saved", label: "Saved", icon: <Heart className="size-4" /> as ReactElement }]
      : [{ href: "/dashboard/listings", label: "My Listings", icon: <Building2 className="size-4" /> as ReactElement }]),
    { href: "/dashboard/inquiries", label: "Viewing Requests", icon: <MessageSquare className="size-4" /> },
    { href: "/dashboard/appointments", label: "Appointments", icon: <CalendarDays className="size-4" /> },
    { href: "/dashboard/reviews", label: "Reviews", icon: <Star className="size-4" /> },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
        <aside className="lg:w-56 lg:shrink-0">
          <SidebarNav items={items} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
