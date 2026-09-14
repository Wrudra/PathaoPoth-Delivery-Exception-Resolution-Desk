import Image from "next/image";
import { cn } from "@/lib/utils";

/** Pathao glyph as-is: white disc, red mark. No tile or frame. */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/pathao-mark.svg"
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      priority
      aria-hidden
    />
  );
}

/** Full wordmark for white surfaces (login, sender view header). */
export function BrandWordmark({ height = 28, className }: { height?: number; className?: string }) {
  return <Image src="/pathao-logo.svg" alt="Pathao" width={Math.round(height * (100 / 29))} height={height} className={className} priority />;
}
