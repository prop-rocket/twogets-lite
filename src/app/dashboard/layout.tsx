import { redirect } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Heart,
  LayoutDashboard,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";

import { SiteHeader } from "@/components/layout/site-header";
import { SidebarNav, type SidebarItem } from "@/components/layout/sidebar-nav";
import { ModeSwitcher } from "@/components/layout/mode-switcher";
import { getActiveMode } from "@/lib/mode";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  if (!user.role) redirect("/onboarding/role");
  if (user.is_banned) redirect("/banned");
  if (user.role === "admin") redirect("/admin");

  const mode = await getActiveMode();
  const hosting = mode === "hosting";

  // The sidebar follows the active mode, not the signup role — the same account
  // sees its renting side or its listing side depending on the switch.
  const items: SidebarItem[] = [
    { href: "/dashboard", label: "Overview", icon: <LayoutDashboard className="size-4" />, exact: true },
    { href: "/dashboard/profile", label: "Profile", icon: <UserRound className="size-4" /> },
    { href: "/dashboard/verification", label: "Verification", icon: <ShieldCheck className="size-4" /> },
    hosting
      ? { href: "/dashboard/listings", label: "My Listings", icon: <Building2 className="size-4" /> }
      : { href: "/dashboard/saved", label: "Saved", icon: <Heart className="size-4" /> },
    {
      href: "/dashboard/viewings",
      label: hosting ? "Viewings" : "My Viewings",
      icon: <CalendarDays className="size-4" />,
    },
    { href: "/dashboard/reviews", label: "Reviews", icon: <Star className="size-4" /> },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6 pb-24 lg:flex-row">
        <aside className="lg:w-56 lg:shrink-0">
          <SidebarNav items={items} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <ModeSwitcher mode={mode} canHost={user.can_host} />
    </div>
  );
}
