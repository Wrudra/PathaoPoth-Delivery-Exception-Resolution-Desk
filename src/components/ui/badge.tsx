import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "brand" | "good" | "warn" | "info" | "violet" | "danger" | "ink";

const tones: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  danger: "bg-brand-500 text-white ring-brand-500",
  good: "bg-good-100 text-good-700 ring-good-100",
  warn: "bg-warn-100 text-warn-700 ring-warn-100",
  info: "bg-info-100 text-info-700 ring-info-100",
  violet: "bg-violet-100 text-violet-700 ring-violet-100",
  ink: "bg-ink-900 text-white ring-ink-900"
};

export function Badge({
  tone = "neutral",
  className,
  dot,
  pulse,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean; pulse?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold leading-5 ring-1 ring-inset",
        tones[tone],
        className
      )}
      {...props}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full bg-current", pulse && "animate-(--animate-pulse-soft)")} /> : null}
      {props.children}
    </span>
  );
}
