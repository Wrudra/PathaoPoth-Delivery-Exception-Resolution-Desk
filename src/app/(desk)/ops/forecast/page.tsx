import type { Metadata } from "next";
import { ForecastPage } from "@/features/ops/ForecastPage";

export const metadata: Metadata = { title: "Route forecast" };

export default function Page() {
  return <ForecastPage />;
}
