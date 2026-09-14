"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";
import { hubShort, routeLabel, teamLabel } from "@/features/domain/constants";
import type { ExceptionCase } from "@/features/domain/types";
import { formatRelative, formatTaka } from "@/lib/format";
import { PriorityDot, SlaBadge, StatusBadge, TypeBadge } from "./badges";

export function CaseTable({ cases, emptyTitle = "No cases", emptyDescription, highlightTeam }: { cases: ExceptionCase[]; emptyTitle?: string; emptyDescription?: string; highlightTeam?: string }) {
  if (!cases.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="overflow-x-auto rounded-(--radius-card) border border-ink-200 bg-white shadow-(--shadow-card)">
      <table className="w-full min-w-[880px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-ink-100 text-left text-[11px] font-bold uppercase tracking-wide text-ink-500">
            <th className="px-4 py-3">Case</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Route</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">SLA</th>
            <th className="px-4 py-3 text-right">COD</th>
            <th className="px-4 py-3">Opened</th>
            <th className="px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {cases.map((item) => {
            const pendingForMe = highlightTeam && item.pendingOwnerTeam === highlightTeam;
            return (
              <tr key={item.ItemId} className={`border-b border-ink-100 last:border-0 hover:bg-ink-50 ${pendingForMe ? "bg-violet-100/40" : ""}`}>
                <td className="px-4 py-3">
                  <Link href={`/cases/${item.ItemId}`} className="group flex items-center gap-2">
                    <PriorityDot priority={item.priority} />
                    <span>
                      <span className="mono block font-semibold text-ink-900 group-hover:text-brand-600">{item.caseNumber}</span>
                      <span className="mono block text-[12px] text-ink-500">{item.trackingId}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={item.type} />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink-900">{routeLabel(item.routeCode)}</div>
                  <div className="text-[12px] text-ink-500">{item.riderName ? `Rider ${item.riderName}` : `Hub ${hubShort(item.hubCode)}`}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink-900">{item.ownerName}</div>
                  <div className="text-[12px] text-ink-500">
                    {teamLabel(item.ownerTeam)}
                    {item.pendingOwnerTeam ? <span className="text-violet-700"> → {teamLabel(item.pendingOwnerTeam)}</span> : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3">
                  <SlaBadge item={item} />
                </td>
                <td className="tabular px-4 py-3 text-right font-semibold text-ink-900">{item.codAmount ? formatTaka(item.codAmount) : "-"}</td>
                <td className="px-4 py-3 text-ink-500">{formatRelative(item.openedAt)}</td>
                <td className="px-2 py-3 text-ink-400">
                  <Link href={`/cases/${item.ItemId}`} aria-label={`Open ${item.caseNumber}`} className="inline-flex rounded-md p-1 hover:bg-ink-100 hover:text-ink-900">
                    <ArrowRight size={16} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
