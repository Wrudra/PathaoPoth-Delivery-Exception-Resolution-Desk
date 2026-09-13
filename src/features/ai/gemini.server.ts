import "server-only";
import { z } from "zod";
import { INCIDENT_LABELS, structureRiderNote } from "./riderNoteEngine";
import { incidentSchema, type IncidentSummary, type NoteContext, type RouteForecastRequest } from "./types";

// Server-only Gemini integration. The key never reaches the browser; the
// browser calls /api/ai/* route handlers which call this module.

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Flash models this project has verified against Google AI Studio generateContent. */
const GEMINI_FALLBACKS = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash"] as const;

export function geminiConfig(): { apiKey: string; model: string } | undefined {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return undefined;
  return { apiKey, model: process.env.GEMINI_MODEL?.trim() || GEMINI_FALLBACKS[0] };
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
};

async function generateJson<T>(prompt: string, responseSchema: Record<string, unknown>, parse: (value: unknown) => T, signal?: AbortSignal): Promise<{ value: T; model: string }> {
  const config = geminiConfig();
  if (!config) throw new Error("Gemini is not configured");

  const models = [config.model, ...GEMINI_FALLBACKS.filter((name) => name !== config.model)];
  let lastError: Error | undefined;

  for (const model of models) {
    const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema
        }
      }),
      signal
    });

    const payload = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
      lastError = new Error(payload.error?.message ?? `Gemini HTTP ${response.status}`);
      if (response.status === 404 || response.status === 429 || response.status === 503) continue;
      throw lastError;
    }
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text) {
      lastError = new Error("Gemini returned no content");
      continue;
    }
    return { value: parse(JSON.parse(text)), model };
  }

  throw lastError ?? new Error("Gemini request failed");
}

const INCIDENT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    attempts: { type: "INTEGER", nullable: true },
    failureReason: { type: "STRING", enum: ["customer_unreachable", "refused", "address_issue", "access_denied", "customer_unavailable", "damaged", "reschedule_requested", "unknown"] },
    secondaryReasons: { type: "ARRAY", items: { type: "STRING" } },
    addressQuality: { type: "STRING", enum: ["good", "incomplete", "vague", "wrong", "unknown"] },
    landmarks: { type: "ARRAY", items: { type: "STRING" } },
    phoneStatus: { type: "STRING", enum: ["off", "unanswered", "wrong_number", "reachable", "unknown"] },
    codIssue: { type: "BOOLEAN" },
    refusalFirm: { type: "BOOLEAN" },
    preferredWindow: { type: "STRING", enum: ["morning", "afternoon", "evening", "night", "tomorrow", "weekend"], nullable: true },
    availabilityHints: { type: "ARRAY", items: { type: "STRING" } },
    summary: { type: "STRING" },
    senderSafeSummary: { type: "STRING" },
    recommendedAction: { type: "STRING", enum: ["evening_redelivery", "call_customer", "return_to_sender", "courier_claim", "address_verification", "manual_review"] },
    confidence: { type: "NUMBER" },
    rationale: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["attempts", "failureReason", "secondaryReasons", "addressQuality", "landmarks", "phoneStatus", "codIssue", "refusalFirm", "preferredWindow", "availabilityHints", "summary", "senderSafeSummary", "recommendedAction", "confidence", "rationale"]
};

function incidentPrompt(rawText: string, context: NoteContext): string {
  return `You are the incident-structuring engine of a Bangladeshi courier's exception desk.
Riders write short notes in Banglish (romanised Bangla mixed with English), often with phonetic spellings
("korsi"/"korechi" = did, "bondho" = off/closed, "dhukte dey na" = won't let me in, "bashay nai" = not at home,
"shondhay" = in the evening, "kal" = tomorrow, "nibe na" = won't take it, "taka nai" = no cash, "vul" = wrong,
"kalo building" = black building, "guard/darowan" = security guard, "ferot" = return).

Turn the rider note below into a structured incident. Rules:
- attempts: number of delivery attempts stated (Bangla number words count: ek=1, dui=2, tin=3, char=4, panch=5); null if not stated.
- failureReason: the single main reason the delivery failed. secondaryReasons: other real reasons present.
- addressQuality: "vague" when only landmarks/colours are given, "incomplete" when house/road numbers are missing, "wrong" when the address is stated to be wrong.
- preferredWindow: only when the receiver gave a time they will be available.
- recommendedAction policy: evening/night availability → evening_redelivery; damage → courier_claim; firm refusal with no reschedule → return_to_sender;
  vague/incomplete/wrong address → address_verification; unreachable/unavailable without a window → call_customer; unclear → manual_review.
- summary: one factual English sentence for staff. senderSafeSummary: one or two sentences for the merchant that reveal no phone numbers, no rider names, no blame.
- confidence: 0..1, honest. Below 0.6 means a human should review. Do not bluff: if the note is unclear, say manual_review with low confidence.
- rationale: 2–4 short bullets explaining the recommendation.

Context: case type = ${context.caseType ?? "unknown"}; COD amount = ${context.codAmount ?? 0} BDT; delivery area = ${context.area ?? "unknown"}.

Rider note:
"""
${rawText.slice(0, 2000)}
"""`;
}

/**
 * Gemini-first structuring with the heuristic engine as an independent
 * cross-check. When both disagree and Gemini is not very sure, the case is
 * flagged for manual review instead of silently trusting either.
 */
export async function structureWithGemini(rawText: string, context: NoteContext, signal?: AbortSignal): Promise<IncidentSummary> {
  const heuristic = structureRiderNote(rawText, context);
  const config = geminiConfig();
  if (!config) return heuristic;

  try {
    const { value, model } = await generateJson(incidentPrompt(rawText, context), INCIDENT_RESPONSE_SCHEMA, (raw) => incidentSchema.parse(raw), signal);
    const agrees = value.recommendedAction === heuristic.recommendedAction;
    let confidence = Number(value.confidence.toFixed(2));
    const rationale = [...value.rationale];
    if (!agrees && confidence < 0.75) {
      confidence = Math.min(confidence, 0.55);
      rationale.push(`Cross-check: the rule engine read this as “${heuristic.recommendedAction.replaceAll("_", " ")}” — flagged for manual review.`);
    } else if (agrees) {
      confidence = Math.min(0.97, Number((confidence + 0.03).toFixed(2)));
    }
    const needsManualReview = confidence < 0.6 || value.recommendedAction === "manual_review";
    return {
      ...value,
      confidence,
      needsManualReview,
      rationale,
      evidence: heuristic.evidence,
      source: "gemini",
      model,
      crossCheck: { recommendedAction: heuristic.recommendedAction, confidence: heuristic.confidence, agrees }
    };
  } catch (error) {
    console.warn("Gemini structuring failed, using heuristic engine:", error instanceof Error ? error.message : error);
    return { ...heuristic, rationale: [...heuristic.rationale, "LLM unavailable; rule engine result shown."] };
  }
}

const FORECAST_SCHEMA = {
  type: "OBJECT",
  properties: {
    narrative: { type: "STRING" },
    precallScript: { type: "STRING" },
    watchouts: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["narrative", "precallScript", "watchouts"]
};

const forecastSchema = z.object({
  narrative: z.string().min(1).max(900),
  precallScript: z.string().min(1).max(700),
  watchouts: z.array(z.string().max(160)).max(4)
});

export type RouteForecastNarrative = z.infer<typeof forecastSchema> & { source: "gemini" | "heuristic"; model?: string };

export async function narrateForecast(request: RouteForecastRequest, signal?: AbortSignal): Promise<RouteForecastNarrative> {
  const fallback: RouteForecastNarrative = {
    narrative: `${request.routeLabel} is trending up. ${request.evidence[0] ?? ""} ${request.evidence[1] ?? ""}`.trim(),
    precallScript:
      "Assalamu alaikum, this is Pathao customer care. You have a cash-on-delivery parcel arriving tomorrow. Could you confirm the address, that someone will be home, and the time that suits you? The amount due is shown in your SMS.",
    watchouts: ["Confirm COD cash before dispatch", "Ask for a landmark plus house/road number", "Offer an evening window"],
    source: "heuristic"
  };
  if (!geminiConfig()) return fallback;

  const prompt = `You are an operations analyst for a Bangladeshi courier. A forecasting model flagged a delivery lane as likely to fail again next week.
Write for an ops manager: (1) a crisp 3–4 sentence narrative that names the route, the pattern, the evidence and the recommended action;
(2) a short, polite Bangladeshi-English pre-call script care agents can read to COD receivers on this lane; (3) up to 4 watch-outs.
Do not invent numbers — use only the evidence given.

Route: ${request.routeLabel} (${request.routeCode})
Recommended action: ${request.recommendedAction}
Metrics: ${JSON.stringify(request.metrics)}
Evidence:
${request.evidence.map((line) => `- ${line}`).join("\n")}`;

  try {
    const { value, model } = await generateJson(prompt, FORECAST_SCHEMA, (raw) => forecastSchema.parse(raw), signal);
    return { ...value, source: "gemini", model };
  } catch (error) {
    console.warn("Gemini forecast narrative failed:", error instanceof Error ? error.message : error);
    return fallback;
  }
}

export const REASON_LABELS = INCIDENT_LABELS.reason;
