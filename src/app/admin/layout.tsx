import { redirect } from "next/navigation";
import {
  Building2,
  FileCheck2,
  Flag,
  LayoutDashboard,
  Star,
  Users,
} from "lucide-react";

import { SiteHeader } from "@/components/layout/site-header";
import { SidebarNav, type SidebarItem } from "@/components/layout/sidebar-nav";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata = { title: "Admin" };

const ITEMS: SidebarItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/verifications", label: "Verifications", icon: FileCheck2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/listings", label: "Listings", icon: Building2 },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/reports", label: "Reports", icon: Flag },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
        <aside className="lg:w-56 lg:shrink-0">
          <SidebarNav items={ITEMS} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
