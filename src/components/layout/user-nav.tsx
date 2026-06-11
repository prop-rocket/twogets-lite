"use client";

import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/server/actions/auth";
import { avatarUrl, initials } from "@/lib/utils";
import type { UserRow } from "@/types";

export function UserNav({ user }: { user: UserRow }) {
  const items = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/profile", label: "Profile", icon: UserRound },
    { href: "/dashboard/verification", label: "Verification Center", icon: ShieldCheck },
    ...(user.role === "tenant"
      ? [
          { href: "/dashboard/saved", label: "Saved Properties", icon: Heart },
          { href: "/dashboard/inquiries", label: "Viewing Requests", icon: MessageSquare },
        ]
      : []),
    ...(user.role === "homeowner"
      ? [
          { href: "/dashboard/listings", label: "My Listings", icon: Building2 },
          { href: "/dashboard/inquiries", label: "Viewing Requests", icon: MessageSquare },
        ]
      : []),
    ...(user.role === "admin"
      ? [{ href: "/admin", label: "Admin Panel", icon: ShieldCheck }]
      : []),
    { href: "/dashboard/appointments", label: "Appointments", icon: CalendarDays },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarUrl(user.avatar_url) ?? undefined} alt={user.full_name} />
            <AvatarFallback>{initials(user.full_name || user.email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-semibold">{user.full_name || "Welcome"}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>
              <item.icon />
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout()}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
