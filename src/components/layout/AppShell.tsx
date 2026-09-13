"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Languages, LogOut, PanelLeftClose, PanelLeftOpen, ShieldAlert, UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { useActor } from "@/features/auth/useStaffProfile";
import { ROLE_LABEL, hubName, teamLabel } from "@/features/domain/constants";
import { useT } from "@/features/i18n/LocalizationProvider";
import { NotificationsMenu } from "@/features/notifications/NotificationsMenu";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStoredPreference } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { BrandMark } from "./BrandMark";
import { ROLE_HOME, isActive, navFor, roleMayVisit } from "./navItems";

const COLLAPSED_KEY = "pathaopoth:sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { logout } = useAuth();
  const { actor } = useActor();
  const { t, language, languages, setLanguage } = useT();
  const [collapsedPref, setCollapsedPref] = useStoredPreference(COLLAPSED_KEY, "false");
  const collapsed = collapsedPref === "true";

  function toggleCollapsed() {
    setCollapsedPref(String(!collapsed));
  }

  const items = navFor(actor?.role, actor?.roles ?? []);
  const allowed = roleMayVisit(actor?.role, pathname);

  useEffect(() => {
    if (!actor?.role || allowed) return;
    router.replace(ROLE_HOME[actor.role]);
  }, [actor?.role, allowed, router]);

  if (actor?.role && !allowed) return <LoadingScreen label="Opening your desk" />;

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-ink-200 bg-white transition-[width] duration-200 md:flex",
          collapsed ? "w-[68px]" : "w-[248px]"
        )}
      >
        <div className={cn("flex h-16 items-center border-b border-ink-100 px-3", collapsed ? "justify-center" : "justify-between")}>
          {collapsed ? null : (
            <Link href="/" className="flex min-w-0 items-center gap-2.5">
              <BrandMark size={32} />
              <span className="truncate text-[15px] font-bold tracking-tight text-ink-900">PathaoPoth</span>
            </Link>
          )}
          <button
            onClick={toggleCollapsed}
            className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2.5">
          {items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={t(item.labelKey)}
                className={cn(
                  "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors",
                  active ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-ink-100 hover:text-ink-900",
                  collapsed && "justify-center px-0"
                )}
              >
                <item.icon size={18} className={cn(active ? "text-brand-600" : "text-ink-500 group-hover:text-ink-900")} />
                {collapsed ? null : <span className="truncate">{t(item.labelKey)}</span>}
                {active && !collapsed ? <span className="absolute right-2 h-5 w-1 rounded-full bg-brand-500" /> : null}
              </Link>
            );
          })}
        </nav>

        {actor ? (
          <div className={cn("border-t border-ink-100 p-3", collapsed && "flex justify-center")}>
            {collapsed ? (
              <Avatar name={actor.name} size="sm" />
            ) : (
              <div className="rounded-xl bg-ink-50 px-3 py-2.5">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">{actor.role ? ROLE_LABEL[actor.role] : "No desk role"}</div>
                <div className="mt-0.5 truncate text-[13px] font-semibold text-ink-900">{actor.hubCode ? hubName(actor.hubCode) : teamLabel(actor.team)}</div>
              </div>
            )}
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-ink-200 bg-white/85 px-4 backdrop-blur md:px-6">
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <BrandMark size={30} />
          </Link>
          <div className="hidden min-w-0 items-center gap-2 text-[13px] text-ink-500 md:flex">
            <span className="font-semibold text-ink-900">{t("app.name")}</span>
            <span className="text-ink-300">/</span>
            <span className="truncate">{t("app.tagline")}</span>
          </div>
          <div className="flex-1" />

          {actor && !actor.role ? (
            <Badge tone="warn" dot>
              <ShieldAlert size={12} /> No desk role assigned
            </Badge>
          ) : null}

          {languages.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 hover:text-ink-900" aria-label="Change language">
                <Languages size={18} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Language</DropdownMenuLabel>
                {languages.map((entry) => (
                  <DropdownMenuItem key={entry.code} onSelect={() => setLanguage(entry.code)}>
                    <span className="flex-1">{entry.name}</span>
                    {entry.code === language ? <span className="text-brand-600">✓</span> : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <NotificationsMenu />

          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-brand-400" aria-label="Open user menu">
              <Avatar name={actor?.name} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[260px]">
              <DropdownMenuLabel className="flex items-center gap-3 normal-case tracking-normal">
                <Avatar name={actor?.name} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-ink-900">{actor?.name ?? "…"}</div>
                  {actor?.email ? <div className="truncate text-[12px] font-normal text-ink-500">{actor.email}</div> : null}
                  {actor?.role ? <div className="mt-0.5 truncate text-[12px] font-normal text-ink-500">{ROLE_LABEL[actor.role]}</div> : null}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/profile")}>
                <UserRound size={16} /> {t("nav.profile")}
              </DropdownMenuItem>
              <DropdownMenuItem destructive onSelect={() => void handleLogout()}>
                <LogOut size={16} /> {t("nav.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-[1240px]">{children}</div>
        </main>

        <nav className="sticky bottom-0 z-30 flex items-stretch border-t border-ink-200 bg-white md:hidden">
          {items.slice(0, 5).map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link key={item.href} href={item.href} className={cn("flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium", active ? "text-brand-600" : "text-ink-500")}>
                <item.icon size={18} />
                <span className="truncate">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
