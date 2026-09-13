import type { Metadata } from "next";
import { PrecallPage } from "@/features/care/PrecallPage";

export const metadata: Metadata = { title: "Pre-call list" };

export default function Page() {
  return <PrecallPage />;
}
