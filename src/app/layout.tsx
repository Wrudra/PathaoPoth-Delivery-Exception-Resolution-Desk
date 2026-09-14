import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import Script from "next/script";
import { Providers } from "@/components/providers/Providers";
import { readBlocksConfigFromEnv } from "@/lib/blocks/config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap"
});

const bengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "PathaoPoth Exception Desk",
    template: "%s · PathaoPoth Exception Desk"
  },
  description:
    "Delivery Exception Resolution Desk: every stuck parcel has exactly one owner, every rider note becomes a next step, and the route that will fail next week is named before it does.",
  icons: { icon: [{ url: "/pathao-mark.svg", type: "image/svg+xml" }] }
};

export const viewport: Viewport = {
  themeColor: "#e83330",
  width: "device-width",
  initialScale: 1
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  const publicConfig = JSON.stringify(readBlocksConfigFromEnv()).replace(/</g, "\\u003c");
  return (
    <html lang="en" className={`${inter.variable} ${bengali.variable} h-full`}>
      <body className="min-h-full font-sans">
        <Script id="pathaopoth-blocks-config" strategy="beforeInteractive">
          {`window.__PATHAOPOTH_BLOCKS__=${publicConfig}`}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
