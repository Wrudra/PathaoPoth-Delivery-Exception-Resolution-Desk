"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Bell, CheckCheck, Clock, PhoneCall, Sparkles } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { fetchInbox, markAllRead, markRead } from "./notifier";

const ICONS = {
  transfer_requested: ArrowLeftRight,
  transfer_acknowledged: CheckCheck,
  sla_breached: Clock,
  next_step_recommended: Sparkles,
  precall_assigned: PhoneCall
} as const;

export function NotificationsMenu() {
  const { status } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const inbox = useQuery({
    queryKey: ["notifier", "inbox"],
    queryFn: fetchInbox,
    enabled: status === "authenticated",
    refetchInterval: 30_000,
    retry: false
  });

  const read = useMutation({
    mutationFn: markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifier", "inbox"] })
  });
  const readAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifier", "inbox"] })
  });

  const unread = inbox.data?.unread ?? 0;
  const items = inbox.data?.items ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative rounded-lg p-2 text-ink-600 hover:bg-ink-100 hover:text-ink-900" aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unread > 0 ? (
            <button onClick={() => readAll.mutate()} className="text-[12px] font-semibold text-brand-600 hover:underline">
              Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-[380px] overflow-y-auto p-1.5">
          {inbox.isError ? (
            <p className="px-3 py-6 text-center text-[13px] text-ink-500">Notifier is not reachable right now.</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
              <CheckCheck size={20} className="text-ink-400" />
              <p className="text-[13px] font-medium text-ink-900">You&apos;re all caught up</p>
              <p className="text-[12px] text-ink-500">Hand-offs, SLA breaches and AI recommendations land here.</p>
            </div>
          ) : (
            items.map((item) => {
              const note = item.notification;
              const Icon = note ? ICONS[note.kind] ?? Bell : Bell;
              return (
                <DropdownMenuItem
                  key={item.id}
                  className={cn("items-start gap-3 py-2.5", !item.isRead && "bg-brand-50/60")}
                  onSelect={() => {
                    if (!item.isRead && item.id) read.mutate(item.id);
                    if (note?.href) router.push(note.href);
                  }}
                >
                  <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full", item.isRead ? "bg-ink-100 text-ink-500" : "bg-brand-100 text-brand-700")}>
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink-900">{note?.title ?? "Notification"}</span>
                    {note?.body ? <span className="block text-[12px] leading-5 text-ink-500">{note.body}</span> : null}
                    {item.createdTime ? <span className="block text-[11px] text-ink-400">{formatRelative(item.createdTime)}</span> : null}
                  </span>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
