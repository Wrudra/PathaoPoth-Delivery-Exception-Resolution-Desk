import { z } from "zod";
import type { NextStep } from "@/features/domain/types";

export const FAILURE_REASONS = [
  "customer_unreachable",
  "refused",
  "address_issue",
  "access_denied",
  "customer_unavailable",
  "damaged",
  "reschedule_requested",
  "unknown"
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

export const ADDRESS_QUALITIES = ["good", "incomplete", "vague", "wrong", "unknown"] as const;
export type AddressQuality = (typeof ADDRESS_QUALITIES)[number];

export const PHONE_STATUSES = ["off", "unanswered", "wrong_number", "reachable", "unknown"] as const;
export type PhoneStatus = (typeof PHONE_STATUSES)[number];

export const WINDOWS = ["morning", "afternoon", "evening", "night", "tomorrow", "weekend"] as const;
export type PreferredWindow = (typeof WINDOWS)[number];

export const NEXT_STEP_VALUES = [
  "evening_redelivery",
  "call_customer",
  "return_to_sender",
  "courier_claim",
  "address_verification",
  "manual_review"
] as const satisfies readonly NextStep[];

export type Evidence = { label: string; quote: string; weight: number };

export type IncidentSummary = {
  attempts: number | null;
  failureReason: FailureReason;
  secondaryReasons: FailureReason[];
  addressQuality: AddressQuality;
  landmarks: string[];
  phoneStatus: PhoneStatus;
  codIssue: boolean;
  refusalFirm: boolean;
  preferredWindow: PreferredWindow | null;
  availabilityHints: string[];
  summary: string;
  senderSafeSummary: string;
  recommendedAction: NextStep;
  confidence: number;
  needsManualReview: boolean;
  rationale: string[];
  evidence: Evidence[];
  source: "heuristic" | "gemini";
  model?: string;
  /** Present when Gemini answered: the heuristic engine's independent read, kept for cross-checking. */
  crossCheck?: { recommendedAction: NextStep; confidence: number; agrees: boolean };
};

export type NoteContext = {
  caseType?: string;
  codAmount?: number;
  area?: string;
  receiverName?: string;
  previousAttempts?: number;
};

export const incidentSchema = z.object({
  attempts: z.number().int().min(0).max(20).nullable(),
  failureReason: z.enum(FAILURE_REASONS),
  secondaryReasons: z.array(z.enum(FAILURE_REASONS)).max(4),
  addressQuality: z.enum(ADDRESS_QUALITIES),
  landmarks: z.array(z.string().max(80)).max(6),
  phoneStatus: z.enum(PHONE_STATUSES),
  codIssue: z.boolean(),
  refusalFirm: z.boolean(),
  preferredWindow: z.enum(WINDOWS).nullable(),
  availabilityHints: z.array(z.string().max(120)).max(6),
  summary: z.string().min(1).max(600),
  senderSafeSummary: z.string().min(1).max(400),
  recommendedAction: z.enum(NEXT_STEP_VALUES),
  confidence: z.number().min(0).max(1),
  rationale: z.array(z.string().max(200)).max(6)
});

export type GeminiIncident = z.infer<typeof incidentSchema>;

export type RouteForecastRequest = {
  routeCode: string;
  routeLabel: string;
  evidence: string[];
  metrics: Record<string, number | string>;
  recommendedAction: string;
};
