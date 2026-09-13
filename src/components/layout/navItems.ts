import {
  Activity,
  BarChart3,
  Bike,
  FolderKanban,
  Headset,
  LifeBuoy,
  PackageSearch,
  PhoneCall,
  PlusCircle,
  Route,
  Settings2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RoleSlug } from "@/features/domain/types";
import type { TranslationKey } from "@/features/i18n/dictionary";

export type NavItem = {
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  roles: RoleSlug[];
  /** Highlight for nested paths too (e.g. /cases/123). */
  prefix?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/cases", labelKey: "nav.cases", icon: FolderKanban, roles: ["hub-staff", "care-agent", "ops-manager"], prefix: true },
  { href: "/cases/new", labelKey: "nav.newCase", icon: PlusCircle, roles: ["hub-staff", "care-agent"] },
  { href: "/rider", labelKey: "nav.rider", icon: Bike, roles: ["rider"] },
  { href: "/care", labelKey: "nav.care", icon: Headset, roles: ["care-agent"] },
  { href: "/care/precalls", labelKey: "nav.precalls", icon: PhoneCall, roles: ["care-agent", "ops-manager"] },
  { href: "/ops", labelKey: "nav.ops", icon: BarChart3, roles: ["ops-manager"] },
  { href: "/ops/forecast", labelKey: "nav.predictions", icon: Route, roles: ["ops-manager"] },
  { href: "/sender", labelKey: "nav.sender", icon: PackageSearch, roles: ["sender"] },
  { href: "/admin", labelKey: "nav.team", icon: Settings2, roles: ["ops-manager"] }
];

export const ROLE_HOME: Record<RoleSlug, string> = {
  "hub-staff": "/cases",
  rider: "/rider",
  "care-agent": "/care",
  "ops-manager": "/ops",
  sender: "/sender"
};

export const ROLE_ICON: Record<RoleSlug, LucideIcon> = {
  "hub-staff": Activity,
  rider: Bike,
  "care-agent": LifeBuoy,
  "ops-manager": BarChart3,
  sender: PackageSearch
};

export function navFor(role: RoleSlug | undefined, roles: string[]): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.some((slug) => slug === role || roles.includes(slug)));
}

export function isActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true;
  if (!item.prefix) return false;
  // /cases/new has its own entry; keep /cases highlighted only for detail pages.
  return pathname.startsWith(`${item.href}/`) && !NAV_ITEMS.some((other) => other !== item && other.href === pathname);
}
