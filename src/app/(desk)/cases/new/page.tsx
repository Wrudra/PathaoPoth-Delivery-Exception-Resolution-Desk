import type { Metadata } from "next";
import { NewCasePage } from "@/features/cases/NewCasePage";

export const metadata: Metadata = { title: "Open a case" };

export default function Page() {
  return <NewCasePage />;
}
