"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Actor } from "@/features/auth/useStaffProfile";
import { unflaggedBreaches } from "@/features/domain/sla";
import type { ExceptionCase } from "@/features/domain/types";
import { flagSlaBreach } from "./caseService";

/**
 * Automatic SLA flagging. Whenever a desk view loads the case list, any case
 * whose deadline has passed but which is not yet flagged gets its breach
 * recorded (flag + event + owner notification). Runs at most once per case
 * per session so several open tabs don't double-post.
 */
export function useSlaSweep(cases: ExceptionCase[] | undefined, actor: Actor | undefined) {
  const queryClient = useQueryClient();
  const swept = useRef(new Set<string>());

  useEffect(() => {
    if (!cases || !actor || actor.role === "sender" || actor.role === "rider") return;
    const due = unflaggedBreaches(cases).filter((item) => !swept.current.has(item.ItemId)).slice(0, 10);
    if (!due.length) return;
    for (const item of due) swept.current.add(item.ItemId);
    const system: Actor = { ...actor, name: "SLA monitor", role: actor.role };
    void Promise.allSettled(due.map((item) => flagSlaBreach(item, system))).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["cases"] });
    });
  }, [actor, cases, queryClient]);
}
