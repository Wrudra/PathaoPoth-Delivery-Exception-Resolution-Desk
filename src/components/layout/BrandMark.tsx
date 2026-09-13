import Image from "next/image";
import { cn } from "@/lib/utils";

/** The Pathao glyph (white disc, red mark) on the brand-red tile. */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  const inner = Math.round(size * 0.66);
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-[28%] bg-brand-500 shadow-[0_1px_2px_rgba(232,51,48,0.35)]", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Image src="/pathao-mark.svg" alt="" width={inner} height={inner} priority />
    </span>
  );
}

/** Full wordmark for white surfaces (login, sender view header). */
export function BrandWordmark({ height = 28, className }: { height?: number; className?: string }) {
  return <Image src="/pathao-logo.svg" alt="Pathao" width={Math.round(height * (100 / 29))} height={height} className={className} priority />;
}
