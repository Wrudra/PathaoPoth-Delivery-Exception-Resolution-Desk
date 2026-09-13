import type { HTMLAttributes, ReactNode } from "react";
import { AlertTriangle, Inbox, Info, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-brand-600">{eyebrow}</div> : null}
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink-900 md:text-[30px]">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-ink-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  className
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "brand" | "good" | "warn";
  icon?: ReactNode;
  className?: string;
}) {
  const accent = {
    neutral: "text-ink-900",
    brand: "text-brand-600",
    good: "text-good-700",
    warn: "text-warn-700"
  }[tone];
  return (
    <div className={cn("rounded-(--radius-card) border border-ink-200 bg-white px-4 py-3.5 shadow-(--shadow-card)", className)}>
      <div className="flex items-center justify-between gap-2 text-[12px] font-semibold uppercase tracking-wide text-ink-500">
        <span className="truncate">{label}</span>
        {icon ? <span className="text-ink-400">{icon}</span> : null}
      </div>
      <div className={cn("mt-1.5 text-[26px] font-bold leading-none tracking-tight tabular", accent)}>{value}</div>
      {hint ? <div className="mt-1.5 text-[12px] text-ink-500">{hint}</div> : null}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-(--radius-card) border border-dashed border-ink-300 bg-white px-6 py-12 text-center", className)}>
      <span className="grid h-11 w-11 place-items-center rounded-full bg-ink-100 text-ink-500">{icon ?? <Inbox size={20} />}</span>
      <h3 className="mt-1 text-[15px] font-semibold text-ink-900">{title}</h3>
      {description ? <p className="max-w-md text-[13px] leading-5 text-ink-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Alert({ tone = "info", title, children, className }: { tone?: "info" | "warn" | "danger" | "good"; title?: ReactNode; children?: ReactNode; className?: string }) {
  const styles = {
    info: "border-info-100 bg-info-100/60 text-info-700",
    warn: "border-warn-100 bg-warn-100/70 text-warn-700",
    danger: "border-brand-200 bg-brand-50 text-brand-700",
    good: "border-good-100 bg-good-100/70 text-good-700"
  }[tone];
  const Icon = tone === "warn" ? AlertTriangle : tone === "danger" ? AlertTriangle : tone === "good" ? CheckCircle2 : Info;
  return (
    <div className={cn("flex gap-3 rounded-xl border px-4 py-3 text-[13px] leading-5", styles, className)}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title ? <div className="font-semibold">{title}</div> : null}
        {children ? <div className={cn(title && "mt-0.5 opacity-90")}>{children}</div> : null}
      </div>
    </div>
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-ink-100", className)} {...props} />;
}

export function Avatar({ name, className, size = "md" }: { name: string | undefined; className?: string; size?: "sm" | "md" | "lg" }) {
  const label = (name ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
  const sizes = { sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-[13px]", lg: "h-14 w-14 text-lg" }[size];
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-ink-900 font-bold text-white", sizes, className)} aria-hidden>
      {label}
    </span>
  );
}

export function ProgressBar({ value, tone = "brand", className }: { value: number; tone?: "brand" | "good" | "warn" | "ink"; className?: string }) {
  const color = { brand: "bg-brand-500", good: "bg-good-600", warn: "bg-warn-600", ink: "bg-ink-900" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink-100", className)}>
      <div className={cn("h-full rounded-full transition-[width]", color)} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[11px] text-ink-700">{children}</kbd>;
}
