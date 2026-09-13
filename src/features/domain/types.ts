// Row types for the nine Blocks Data schemas in blocks/data/schemas/*.json.
// Every row carries the platform-managed system fields (ItemId, CreatedDate…);
// DateTime fields travel as ISO-8601 strings.

export type SystemFields = {
  ItemId: string;
  CreatedDate?: string;
  LastUpdatedDate?: string;
  CreatedBy?: string;
  LastUpdatedBy?: string;
};

export type ExceptionType = "delayed" | "damaged" | "refused" | "address_missing" | "disputed";
export type CaseStatus = "open" | "awaiting_ack" | "in_progress" | "resolved" | "closed";
export type CasePriority = "normal" | "high" | "critical";
export type NextStep =
  | "evening_redelivery"
  | "call_customer"
  | "return_to_sender"
  | "courier_claim"
  | "address_verification"
  | "manual_review";
export type NextStepStatus = "none" | "recommended" | "confirmed" | "manual_review";
export type AiSource = "heuristic" | "gemini" | "human";
export type ParcelStatus = "in_transit" | "out_for_delivery" | "exception" | "delivered" | "returned";
export type RoleSlug = "hub-staff" | "rider" | "care-agent" | "ops-manager" | "sender";

export type Rider = SystemFields & {
  riderCode: string;
  name: string;
  phone?: string;
  hubCode: string;
  vendor: "in_house" | "vendor";
  vendorName?: string;
  userId?: string;
  active: boolean;
  rating?: number;
  joinedAt?: string;
  skills?: string[];
};

export type Parcel = SystemFields & {
  trackingId: string;
  senderUserId?: string;
  senderName: string;
  senderCompany: string;
  receiverName: string;
  receiverPhone?: string;
  receiverAddress?: string;
  area: string;
  originHubCode: string;
  destHubCode: string;
  routeCode: string;
  riderId?: string;
  riderName?: string;
  codAmount: number;
  paymentType: "cod" | "prepaid";
  weightKg?: number;
  status: ParcelStatus;
  lastTouchedByName?: string;
  lastTouchedAt?: string;
  dispatchedAt?: string;
  promisedAt?: string;
};

export type ExceptionCase = SystemFields & {
  caseNumber: string;
  parcelId: string;
  trackingId: string;
  senderUserId?: string;
  type: ExceptionType;
  status: CaseStatus;
  priority: CasePriority;
  hubCode: string;
  originHubCode: string;
  destHubCode: string;
  routeCode: string;
  riderId?: string;
  riderName?: string;
  codAmount: number;
  openedByUserId: string;
  openedByName: string;
  openedAt: string;
  ownerUserId: string;
  ownerName: string;
  ownerTeam: string;
  ownerSince: string;
  pendingOwnerTeam?: string;
  pendingOwnerUserId?: string;
  transferRequestedByName?: string;
  transferRequestedAt?: string;
  transferNote?: string;
  slaDueAt: string;
  slaBreached: boolean;
  slaBreachedAt?: string;
  nextStep?: NextStep;
  nextStepStatus: NextStepStatus;
  nextStepConfidence?: number;
  nextStepSource?: AiSource;
  nextStepConfirmedByName?: string;
  nextStepConfirmedAt?: string;
  incidentJson?: string;
  description?: string;
  resolution?: string;
  resolvedAt?: string;
  closedAt?: string;
  seedTag?: string;
};

export type CaseEventType =
  | "opened"
  | "note_added"
  | "rider_note"
  | "ai_structured"
  | "next_step_confirmed"
  | "transfer_requested"
  | "transfer_acknowledged"
  | "transfer_declined"
  | "status_changed"
  | "sla_breached"
  | "resolved"
  | "closed"
  | "sender_update";

export type CaseEvent = SystemFields & {
  caseId: string;
  caseNumber: string;
  type: CaseEventType;
  actorUserId: string;
  actorName: string;
  actorRole?: string;
  actorTeam?: string;
  fromOwnerTeam?: string;
  fromOwnerName?: string;
  toOwnerTeam?: string;
  toOwnerName?: string;
  message: string;
  internal: boolean;
  payloadJson?: string;
  occurredAt: string;
};

export type RiderNoteStatus = "pending" | "structured" | "confirmed" | "manual_review";

export type RiderNote = SystemFields & {
  caseId: string;
  caseNumber: string;
  parcelId: string;
  trackingId: string;
  riderId?: string;
  riderName: string;
  riderUserId?: string;
  rawText: string;
  language: "banglish" | "bn" | "en";
  structuredJson?: string;
  recommendedAction?: NextStep;
  confidence?: number;
  source?: AiSource;
  status: RiderNoteStatus;
  confirmedByName?: string;
  confirmedAt?: string;
  submittedAt: string;
};

export type SenderUpdateStatus = "investigating" | "action_planned" | "in_progress" | "resolved" | "returned";

export type SenderUpdate = SystemFields & {
  caseId: string;
  caseNumber: string;
  parcelId: string;
  trackingId: string;
  senderUserId?: string;
  status: SenderUpdateStatus;
  headline: string;
  detail: string;
  nextAction?: string;
  expectedResolutionAt?: string;
  occurredAt: string;
};

export type StaffProfile = SystemFields & {
  userId: string;
  email?: string;
  displayName: string;
  role: RoleSlug;
  hubCode?: string;
  team: string;
  phone?: string;
  riderId?: string;
  senderCompany?: string;
};

export type RiskLevel = "low" | "medium" | "high";
export type RouteAction = "precall_cod_customers" | "reassign_rider" | "address_verification" | "monitor";
export type RouteDecision = "none" | "precall_scheduled" | "route_changed" | "dismissed";

export type RoutePrediction = SystemFields & {
  routeCode: string;
  originHubCode: string;
  destHubCode: string;
  weekStart: string;
  horizonWeekStart: string;
  riskLevel: RiskLevel;
  riskScore: number;
  predictedExceptionRate: number;
  baselineExceptionRate: number;
  weekOverWeekChange: number;
  dominantType: ExceptionType | "none";
  evidenceJson: string;
  recommendedAction: RouteAction;
  narrative?: string;
  source: AiSource;
  generatedAt: string;
  generatedByName: string;
  decision: RouteDecision;
  decidedByName?: string;
  decidedAt?: string;
};

export type PrecallStatus = "pending" | "confirmed" | "reschedule" | "no_answer" | "cancelled";

export type PrecallTask = SystemFields & {
  predictionId: string;
  routeCode: string;
  parcelId: string;
  trackingId: string;
  receiverName: string;
  receiverPhone?: string;
  area: string;
  codAmount: number;
  reason: string;
  assignedToTeam: string;
  assignedToName?: string;
  status: PrecallStatus;
  outcomeNote?: string;
  createdByName: string;
  calledAt?: string;
  dueAt?: string;
};

/** Field lists drive the GraphQL selection sets -- keep them in sync with the schema JSON. */
export const FIELDS = {
  Rider: ["riderCode", "name", "phone", "hubCode", "vendor", "vendorName", "userId", "active", "rating", "joinedAt", "skills"],
  Parcel: [
    "trackingId", "senderUserId", "senderName", "senderCompany", "receiverName", "receiverPhone", "receiverAddress", "area",
    "originHubCode", "destHubCode", "routeCode", "riderId", "riderName", "codAmount", "paymentType", "weightKg", "status",
    "lastTouchedByName", "lastTouchedAt", "dispatchedAt", "promisedAt"
  ],
  ExceptionCase: [
    "caseNumber", "parcelId", "trackingId", "senderUserId", "type", "status", "priority", "hubCode", "originHubCode", "destHubCode",
    "routeCode", "riderId", "riderName", "codAmount", "openedByUserId", "openedByName", "openedAt", "ownerUserId", "ownerName",
    "ownerTeam", "ownerSince", "pendingOwnerTeam", "pendingOwnerUserId", "transferRequestedByName", "transferRequestedAt",
    "transferNote", "slaDueAt", "slaBreached", "slaBreachedAt", "nextStep", "nextStepStatus", "nextStepConfidence", "nextStepSource",
    "nextStepConfirmedByName", "nextStepConfirmedAt", "incidentJson", "description", "resolution", "resolvedAt", "closedAt", "seedTag"
  ],
  CaseEvent: [
    "caseId", "caseNumber", "type", "actorUserId", "actorName", "actorRole", "actorTeam", "fromOwnerTeam", "fromOwnerName",
    "toOwnerTeam", "toOwnerName", "message", "internal", "payloadJson", "occurredAt"
  ],
  RiderNote: [
    "caseId", "caseNumber", "parcelId", "trackingId", "riderId", "riderName", "riderUserId", "rawText", "language", "structuredJson",
    "recommendedAction", "confidence", "source", "status", "confirmedByName", "confirmedAt", "submittedAt"
  ],
  SenderUpdate: [
    "caseId", "caseNumber", "parcelId", "trackingId", "senderUserId", "status", "headline", "detail", "nextAction",
    "expectedResolutionAt", "occurredAt"
  ],
  StaffProfile: ["userId", "email", "displayName", "role", "hubCode", "team", "phone", "riderId", "senderCompany"],
  RoutePrediction: [
    "routeCode", "originHubCode", "destHubCode", "weekStart", "horizonWeekStart", "riskLevel", "riskScore", "predictedExceptionRate",
    "baselineExceptionRate", "weekOverWeekChange", "dominantType", "evidenceJson", "recommendedAction", "narrative", "source",
    "generatedAt", "generatedByName", "decision", "decidedByName", "decidedAt"
  ],
  PrecallTask: [
    "predictionId", "routeCode", "parcelId", "trackingId", "receiverName", "receiverPhone", "area", "codAmount", "reason",
    "assignedToTeam", "assignedToName", "status", "outcomeNote", "createdByName", "calledAt", "dueAt"
  ]
} as const;

export type SchemaName = keyof typeof FIELDS;
