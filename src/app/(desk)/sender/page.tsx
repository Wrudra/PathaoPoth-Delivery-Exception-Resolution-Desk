import type { Metadata } from "next";
import { SenderPage } from "@/features/sender/SenderPage";

export const metadata: Metadata = { title: "My parcels" };

export default function Page() {
  return <SenderPage />;
}
