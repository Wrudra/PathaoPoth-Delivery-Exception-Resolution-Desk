import type { Metadata } from "next";
import { AdminPage } from "@/features/admin/AdminPage";

export const metadata: Metadata = { title: "Team & data" };

export default function Page() {
  return <AdminPage />;
}
