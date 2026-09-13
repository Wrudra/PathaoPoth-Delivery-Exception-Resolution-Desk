import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 shadow-[0_1px_2px_rgba(232,51,48,0.25)] disabled:bg-brand-300",
  secondary: "bg-ink-900 text-white hover:bg-ink-700 disabled:bg-ink-400",
  outline: "border border-ink-200 bg-white text-ink-900 hover:bg-ink-50 hover:border-ink-300",
  ghost: "text-ink-700 hover:bg-ink-100 hover:text-ink-900",
  danger: "bg-white border border-brand-200 text-brand-700 hover:bg-brand-50",
  success: "bg-good-600 text-white hover:bg-good-700"
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg"
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading = false, icon, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-all",
        "active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
});
