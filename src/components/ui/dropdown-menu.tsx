"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({ className, sideOffset = 8, ...props }: ComponentPropsWithoutRef<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[200px] overflow-hidden rounded-xl border border-ink-200 bg-white p-1.5 shadow-(--shadow-pop)",
          className
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({ className, destructive, ...props }: ComponentPropsWithoutRef<typeof Menu.Item> & { destructive?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none transition-colors",
        destructive ? "text-brand-700 data-[highlighted]:bg-brand-50" : "text-ink-900 data-[highlighted]:bg-ink-100",
        className
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentPropsWithoutRef<typeof Menu.Label>) {
  return <Menu.Label className={cn("px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentPropsWithoutRef<typeof Menu.Separator>) {
  return <Menu.Separator className={cn("my-1 h-px bg-ink-100", className)} {...props} />;
}
