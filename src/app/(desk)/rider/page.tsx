import type { Metadata } from "next";
import { RiderPage } from "@/features/rider/RiderPage";

export const metadata: Metadata = { title: "My deliveries" };

export default function Page() {
  return <RiderPage />;
}
