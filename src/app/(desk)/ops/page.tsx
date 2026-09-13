import type { Metadata } from "next";
import { OpsPage } from "@/features/ops/OpsPage";

export const metadata: Metadata = { title: "Ops overview" };

export default function Page() {
  return <OpsPage />;
}
