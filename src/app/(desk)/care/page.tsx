import type { Metadata } from "next";
import { CarePage } from "@/features/care/CarePage";

export const metadata: Metadata = { title: "Care queue" };

export default function Page() {
  return <CarePage />;
}
