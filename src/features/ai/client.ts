"use client";

import { useQuery } from "@tanstack/react-query";
import type { RouteForecastNarrative } from "./gemini.server";
import { structureRiderNote } from "./riderNoteEngine";
import type { IncidentSummary, NoteContext, RouteForecastRequest } from "./types";

// Browser-side access to the AI route handlers. The Gemini key lives on the
// server; if the server is unreachable the heuristic engine runs locally so
// the desk never blocks on the model.

export async function structureNote(text: string, context: NoteContext = {}): Promise<IncidentSummary> {
  try {
    const response = await fetch("/api/ai/structure-note", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, context })
    });
    if (!response.ok) throw new Error(`AI route ${response.status}`);
    return (await response.json()) as IncidentSummary;
  } catch (error) {
    console.warn("AI route unavailable, using local engine:", error);
    return structureRiderNote(text, context);
  }
}

export async function narrateRoute(request: RouteForecastRequest): Promise<RouteForecastNarrative> {
  const response = await fetch("/api/ai/route-forecast", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request)
  });
  if (!response.ok) throw new Error(`AI route ${response.status}`);
  return (await response.json()) as RouteForecastNarrative;
}

export type AiStatus = { provider: "gemini" | "heuristic"; model: string | null; configured: boolean };

export function useAiStatus() {
  return useQuery({
    queryKey: ["ai", "status"],
    queryFn: async (): Promise<AiStatus> => {
      const response = await fetch("/api/ai/status");
      if (!response.ok) return { provider: "heuristic", model: null, configured: false };
      return (await response.json()) as AiStatus;
    },
    staleTime: 5 * 60_000
  });
}
