import type { CaseStatus, ExceptionType, NextStep, RoleSlug } from "./types";

export type Hub = { code: string; name: string; city: string; short: string };

export const HUBS: Hub[] = [
  { code: "MIR10", name: "Mirpur 10", city: "Dhaka", short: "Mirpur" },
  { code: "MOG", name: "Moghbazar", city: "Dhaka", short: "Moghbazar" },
  { code: "UTT", name: "Uttara Sector 7", city: "Dhaka", short: "Uttara" },
  { code: "DHN", name: "Dhanmondi 27", city: "Dhaka", short: "Dhanmondi" },
  { code: "CTGGEC", name: "Chattogram GEC", city: "Chattogram", short: "CTG GEC" },
  { code: "CTGAGR", name: "Chattogram Agrabad", city: "Chattogram", short: "Agrabad" },
  { code: "SYL", name: "Sylhet Zindabazar", city: "Sylhet", short: "Sylhet" },
  { code: "KHL", name: "Khulna Sonadanga", city: "Khulna", short: "Khulna" }
];

export const HUB_BY_CODE: Record<string, Hub> = Object.fromEntries(HUBS.map((hub) => [hub.code, hub]));

export function hubName(code: string | undefined): string {
  if (!code) return "-";
  return HUB_BY_CODE[code]?.name ?? code;
}

export function hubShort(code: string | undefined): string {
  if (!code) return "-";
  return HUB_BY_CODE[code]?.short ?? code;
}

export type Route = { code: string; origin: string; dest: string; weeklyVolume: number };

export const ROUTES: Route[] = [
  { code: "MIR10-CTGGEC", origin: "MIR10", dest: "CTGGEC", weeklyVolume: 640 },
  { code: "MIR10-MOG", origin: "MIR10", dest: "MOG", weeklyVolume: 900 },
  { code: "MIR10-UTT", origin: "MIR10", dest: "UTT", weeklyVolume: 780 },
  { code: "MOG-DHN", origin: "MOG", dest: "DHN", weeklyVolume: 820 },
  { code: "MOG-CTGAGR", origin: "MOG", dest: "CTGAGR", weeklyVolume: 510 },
  { code: "UTT-SYL", origin: "UTT", dest: "SYL", weeklyVolume: 430 },
  { code: "DHN-KHL", origin: "DHN", dest: "KHL", weeklyVolume: 380 },
  { code: "CTGGEC-MIR10", origin: "CTGGEC", dest: "MIR10", weeklyVolume: 560 }
];

export const ROUTE_BY_CODE: Record<string, Route> = Object.fromEntries(ROUTES.map((route) => [route.code, route]));

export function routeLabel(code: string | undefined): string {
  if (!code) return "-";
  const route = ROUTE_BY_CODE[code];
  if (route) return `${hubShort(route.origin)} → ${hubShort(route.dest)}`;
  const [origin, dest] = code.split("-");
  return `${hubShort(origin)} → ${hubShort(dest)}`;
}

export function routeCodeFor(origin: string, dest: string): string {
  return `${origin}-${dest}`;
}

export type ExceptionTypeMeta = {
  label: string;
  short: string;
  slaHours: number;
  description: string;
};

export const EXCEPTION_TYPES: Record<ExceptionType, ExceptionTypeMeta> = {
  refused: { label: "Refused delivery", short: "Refused", slaHours: 24, description: "Receiver declined the parcel or the COD amount." },
  delayed: { label: "Delayed", short: "Delayed", slaHours: 24, description: "Parcel is past its promised delivery time." },
  damaged: { label: "Damaged", short: "Damaged", slaHours: 48, description: "Packaging or contents damaged in transit." },
  address_missing: { label: "Address missing / wrong", short: "Address", slaHours: 24, description: "Rider cannot locate the receiver address." },
  disputed: { label: "Disputed by sender", short: "Disputed", slaHours: 72, description: "Sender disputes the delivery status or COD collection." }
};

export const EXCEPTION_TYPE_LIST = Object.keys(EXCEPTION_TYPES) as ExceptionType[];

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  open: "Open",
  awaiting_ack: "Awaiting acknowledgement",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed"
};

export const NEXT_STEPS: Record<NextStep, { label: string; description: string; senderSafe: string }> = {
  evening_redelivery: {
    label: "Evening redelivery window",
    description: "Dispatch again in the 6-9 pm window when the receiver said they would be home.",
    senderSafe: "A redelivery attempt is scheduled for this evening."
  },
  call_customer: {
    label: "Call the customer",
    description: "Care calls the receiver to confirm availability, COD cash, and the exact address before the next attempt.",
    senderSafe: "Our care team is contacting the receiver to arrange delivery."
  },
  return_to_sender: {
    label: "Return to sender",
    description: "Receiver firmly refused; route the parcel back to the origin hub for return.",
    senderSafe: "The receiver declined the parcel. It is being returned to you."
  },
  courier_claim: {
    label: "Courier claim",
    description: "Open a damage claim and offer the sender a refund or credit.",
    senderSafe: "The parcel was damaged in transit. A claim has been opened on your behalf."
  },
  address_verification: {
    label: "Verify address",
    description: "Address is vague or wrong; collect house/road number and a landmark before redispatch.",
    senderSafe: "We are confirming the delivery address with the receiver."
  },
  manual_review: {
    label: "Manual review",
    description: "The note was not clear enough to act on automatically. A care agent decides the next step.",
    senderSafe: "Our team is reviewing this delivery."
  }
};

export const ROLE_LABEL: Record<RoleSlug, string> = {
  "hub-staff": "Hub staff",
  rider: "Rider",
  "care-agent": "Care agent",
  "ops-manager": "Ops manager",
  sender: "Sender"
};

/** Team keys: `hub:<HUBCODE>`, `care`, `ops`. */
export function teamForHub(hubCode: string): string {
  return `hub:${hubCode}`;
}

export function teamLabel(team: string | undefined): string {
  if (!team) return "-";
  if (team === "care") return "Customer care";
  if (team === "ops") return "Operations";
  if (team === "sender") return "Sender";
  if (team.startsWith("hub:")) return `${hubName(team.slice(4))} hub`;
  return team;
}

export function teamRole(team: string): RoleSlug {
  if (team === "care") return "care-agent";
  if (team === "ops") return "ops-manager";
  if (team === "sender") return "sender";
  return "hub-staff";
}

export const SEED_TAG = "demo-2026-09";

/** Realistic Bangladeshi merchant names used by the seed and the sender demo mapping. */
export const SENDER_COMPANIES = ["Dokan24", "Rokomari Books", "Aarong Online", "Chaldal", "Pickaboo", "Sailor Lifestyle"];
