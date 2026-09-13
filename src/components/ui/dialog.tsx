"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  title,
  description,
  children,
  footer,
  className,
  wide
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ink-200 bg-white shadow-(--shadow-pop) focus:outline-none",
          wide ? "max-w-2xl" : "max-w-lg",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-6 py-4">
          <div>
            <DialogPrimitive.Title className="text-[17px] font-semibold text-ink-900">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="mt-1 text-[13px] leading-5 text-ink-500">{description}</DialogPrimitive.Description> : null}
          </div>
          <DialogPrimitive.Close className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900" aria-label="Close">
            <X size={18} />
          </DialogPrimitive.Close>
        </div>
        {children ? <div className="px-6 py-5">{children}</div> : null}
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-6 py-4">{footer}</div> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
