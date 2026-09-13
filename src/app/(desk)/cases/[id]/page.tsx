import type { Metadata } from "next";
import { CaseDetailPage } from "@/features/cases/CaseDetailPage";

export const metadata: Metadata = { title: "Case" };

export default async function Page({ params }: PageProps<"/cases/[id]">) {
  const { id } = await params;
  return <CaseDetailPage id={id} />;
}
