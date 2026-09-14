import { EXCEPTION_TYPES, HUBS, ROUTES, SEED_TAG, SENDER_COMPANIES, teamForHub } from "@/features/domain/constants";
import { slaDueFor } from "@/features/domain/sla";
import type {
  CaseEvent,
  ExceptionCase,
  ExceptionType,
  NextStep,
  Parcel,
  Rider,
  RiderNote,
  SenderUpdate,
  SystemFields
} from "@/features/domain/types";
import { structureRiderNote } from "@/features/ai/riderNoteEngine";

// Deterministic demo dataset. Same seed → same rows, so the story is stable:
// Mirpur 10 → Chattogram GEC refused deliveries climb 8 → 10 → 17 → 24 over
// four rolling weeks (+41% in the last step), three quarters of them COD, a
// third of them on one rider, enough for the forecaster to name the lane and
// recommend a pre-call list.

type Row<T extends SystemFields> = Omit<T, keyof SystemFields>;

export type SeedBundle = {
  riders: Row<Rider>[];
  parcels: (Row<Parcel> & { seedKey: string })[];
  cases: (Row<ExceptionCase> & { seedKey: string; parcelKey: string })[];
  events: (Row<CaseEvent> & { caseKey: string })[];
  notes: (Row<RiderNote> & { caseKey: string; parcelKey: string })[];
  senderUpdates: (Row<SenderUpdate> & { caseKey: string; parcelKey: string })[];
  demoTrackingId: string;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

const FIRST = ["Farhana", "Tanvir", "Nusrat", "Rakib", "Sumaiya", "Mahmud", "Sadia", "Imran", "Tasnim", "Arif", "Jannat", "Shakil", "Mim", "Fahim", "Rumana", "Shohag", "Nabila", "Rafi", "Tania", "Sabbir", "Mou", "Hasan", "Priya", "Nayeem"];
const LAST = ["Akter", "Ahmed", "Islam", "Hossain", "Rahman", "Chowdhury", "Karim", "Sultana", "Khan", "Uddin", "Begum", "Mia", "Siddique", "Bhuiyan", "Talukder"];
const SENDER_PEOPLE = ["Mizanur Rahman", "Sharmin Sultana", "Kazi Anis", "Rezaul Karim", "Nadia Ferdous", "Taufiq Elahi"];

const AREAS: Record<string, string[]> = {
  MIR10: ["Mirpur 10", "Kazipara", "Shewrapara", "Pallabi", "Mirpur DOHS"],
  MOG: ["Moghbazar", "Malibagh", "Eskaton", "Siddheswari", "Rampura"],
  UTT: ["Uttara Sector 7", "Uttara Sector 11", "Azampur", "Diabari", "Abdullahpur"],
  DHN: ["Dhanmondi 27", "Dhanmondi 15", "Jigatola", "Lalmatia", "Shankar"],
  CTGGEC: ["GEC Circle", "Nasirabad", "Khulshi", "Muradpur", "Panchlaish", "O R Nizam Road"],
  CTGAGR: ["Agrabad", "Halishahar", "Chowmuhani", "Dewanhat", "Sholoshohor"],
  SYL: ["Zindabazar", "Ambarkhana", "Shibganj", "Upashahar", "Subidbazar"],
  KHL: ["Sonadanga", "Khalishpur", "Boyra", "Gollamari", "Nirala"]
};

const STREETS = ["Road", "Lane", "Goli", "Avenue"];

const HUB_STAFF: Record<string, string[]> = {
  MIR10: ["Rafiq Hasan", "Shamima Nasrin"],
  MOG: ["Kamrul Islam", "Lubna Yasmin"],
  UTT: ["Sohel Rana", "Dilruba Khanam"],
  DHN: ["Asif Iqbal", "Rokeya Sultana"],
  CTGGEC: ["Mohammad Faisal", "Ayesha Siddika"],
  CTGAGR: ["Nur Alam", "Tahmina Haque"],
  SYL: ["Jamil Ahmed", "Salma Begum"],
  KHL: ["Habibur Rahman", "Munni Akter"]
};
const CARE_AGENTS = ["Nabila Rahman", "Tanvir Hossain", "Sumaiya Islam"];

const RIDER_SPECS: { code: string; name: string; hub: string; vendor: Rider["vendor"]; vendorName?: string }[] = [
  { code: "R-MIR-014", name: "Jashim Uddin", hub: "MIR10", vendor: "in_house" },
  { code: "R-MIR-021", name: "Sajib Molla", hub: "MIR10", vendor: "vendor", vendorName: "Speedo Logistics" },
  { code: "R-MIR-033", name: "Ripon Sheikh", hub: "MIR10", vendor: "in_house" },
  { code: "R-MOG-007", name: "Alamgir Hossain", hub: "MOG", vendor: "in_house" },
  { code: "R-MOG-012", name: "Delowar Hussain", hub: "MOG", vendor: "vendor", vendorName: "City Riders" },
  { code: "R-UTT-004", name: "Masud Parvez", hub: "UTT", vendor: "in_house" },
  { code: "R-UTT-019", name: "Rubel Miah", hub: "UTT", vendor: "vendor", vendorName: "Speedo Logistics" },
  { code: "R-DHN-002", name: "Shahin Alam", hub: "DHN", vendor: "in_house" },
  { code: "R-GEC-011", name: "Kamal Uddin", hub: "CTGGEC", vendor: "in_house" },
  { code: "R-GEC-016", name: "Abul Kashem", hub: "CTGGEC", vendor: "vendor", vendorName: "Port City Express" },
  { code: "R-GEC-023", name: "Mizan Chowdhury", hub: "CTGGEC", vendor: "in_house" },
  { code: "R-AGR-005", name: "Faruk Ahmed", hub: "CTGAGR", vendor: "in_house" },
  { code: "R-SYL-003", name: "Anwar Hossain", hub: "SYL", vendor: "in_house" },
  { code: "R-KHL-006", name: "Liton Das", hub: "KHL", vendor: "vendor", vendorName: "Sundarban Couriers" }
];

// Exceptions per route per rolling week [W-3, W-2, W-1, W0]. W0 = last 7 days.
type RoutePlan = Partial<Record<ExceptionType, [number, number, number, number]>>;
const PLAN: Record<string, RoutePlan> = {
  "MIR10-CTGGEC": { refused: [8, 10, 17, 24], delayed: [3, 3, 4, 4], address_missing: [2, 2, 3, 3], damaged: [1, 0, 1, 1] },
  "MIR10-MOG": { delayed: [3, 2, 3, 2], refused: [2, 3, 2, 3], address_missing: [1, 1, 1, 1] },
  "MIR10-UTT": { delayed: [2, 3, 2, 3], refused: [2, 2, 3, 2], damaged: [1, 0, 0, 1] },
  "MOG-DHN": { delayed: [3, 3, 2, 3], refused: [1, 2, 2, 2], disputed: [1, 0, 1, 1] },
  "MOG-CTGAGR": { refused: [3, 3, 4, 3], delayed: [2, 2, 2, 2], address_missing: [1, 2, 1, 1] },
  "UTT-SYL": { address_missing: [3, 4, 5, 6], delayed: [2, 2, 2, 3], refused: [1, 1, 2, 1] },
  "DHN-KHL": { delayed: [1, 2, 1, 1], refused: [1, 1, 1, 0], damaged: [0, 1, 0, 0] },
  "CTGGEC-MIR10": { delayed: [2, 3, 2, 2], refused: [2, 2, 3, 2], disputed: [0, 1, 0, 1] }
};

const RIDER_NOTES: Record<ExceptionType, string[]> = {
  refused: [
    "customer bole COD taka ready nai, kal dite bolse. 2 bar try korsi.",
    "receiver nibe na, bole order kore nai. ferot niye aslam hub e.",
    "dam beshi bole nite chay na, 2300 taka dite parbe na bolse. shondhay abar call dite bolse.",
    "3 bar try korsi, phone off, guard dhukte dey na. shondhay thakbe bolse, taka ready nai.",
    "customer bole onno jinish order korsilo, nibe na. cancel korte bolse."
  ],
  delayed: ["jam e atka porsi, aj dite parbo na, kal sokale jabo", "hub theke late e paisi parcel, customer bashay nai, kal dibo", "dui bar gesi, phone dhore na, kal abar try korbo"],
  damaged: ["packet bhije gese, box vanga, customer nite chay na", "box er ek pash vanga, customer bole vitorer jinish nosto, nibe na"],
  address_missing: ["address pai nai, house number nai, shudhu boro mosjid er pashe likha. call dhore na.", "thikana vul, ei road e oi building nai. customer bole onno area.", "2 ta kalo building er pashe bolse, khuje pai nai, phone bondho"],
  disputed: ["sender bole delivery hoy nai, kintu receiver bole paise. proof pathaisi hub e", "COD amount niye jhamela, receiver bole 1500 disilo, sheet e 1800"]
};

const NEXT_STEP_FOR: Record<ExceptionType, NextStep[]> = {
  refused: ["call_customer", "evening_redelivery", "return_to_sender"],
  delayed: ["evening_redelivery", "call_customer"],
  damaged: ["courier_claim"],
  address_missing: ["address_verification", "call_customer"],
  disputed: ["manual_review", "call_customer"]
};

function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)]!;
}

function phone(rand: () => number): string {
  const prefixes = ["017", "018", "019", "016", "013", "015"];
  let digits = "";
  for (let index = 0; index < 8; index += 1) digits += Math.floor(rand() * 10);
  return `+880 ${pick(rand, prefixes).slice(1)}${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function personName(rand: () => number): string {
  return `${pick(rand, FIRST)} ${pick(rand, LAST)}`;
}

function address(rand: () => number, area: string): string {
  const house = Math.floor(rand() * 120) + 1;
  const suffix = rand() < 0.3 ? `/${pick(rand, ["A", "B", "C"])}` : "";
  const road = Math.floor(rand() * 20) + 1;
  return `House ${house}${suffix}, ${pick(rand, STREETS)} ${road}, ${area}`;
}

function codAmount(rand: () => number, bias: "high" | "normal"): number {
  if (rand() < (bias === "high" ? 0.12 : 0.35)) return 0; // prepaid
  const base = bias === "high" ? 1200 + rand() * 2600 : 350 + rand() * 1900;
  return Math.round(base / 10) * 10;
}

export function buildSeed(now = new Date()): SeedBundle {
  const rand = mulberry32(20260914);
  const riders: Row<Rider>[] = RIDER_SPECS.map((spec, index) => ({
    riderCode: spec.code,
    name: spec.name,
    phone: phone(rand),
    hubCode: spec.hub,
    vendor: spec.vendor,
    vendorName: spec.vendorName,
    active: true,
    rating: Number((3.9 + rand() * 1.0).toFixed(1)),
    joinedAt: new Date(now.getTime() - (200 + index * 37) * DAY).toISOString(),
    skills: spec.vendor === "in_house" ? ["cod", "fragile", "evening"] : ["cod"]
  }));
  const ridersByHub = (hub: string) => RIDER_SPECS.filter((spec) => spec.hub === hub);

  const parcels: SeedBundle["parcels"] = [];
  const cases: SeedBundle["cases"] = [];
  const events: SeedBundle["events"] = [];
  const notes: SeedBundle["notes"] = [];
  const senderUpdates: SeedBundle["senderUpdates"] = [];

  let trackingSeq = 118_000;
  let caseSeq = 4_100;
  const nextTracking = () => `PP-2609-${trackingSeq++}`;

  function makeParcel(routeCode: string, dispatchedAt: Date, opts: { cod?: number; area?: string; rider?: (typeof RIDER_SPECS)[number]; status?: Parcel["status"]; receiverName?: string; senderIndex?: number } = {}) {
    const route = ROUTES.find((item) => item.code === routeCode)!;
    const area = opts.area ?? pick(rand, AREAS[route.dest] ?? [HUBS.find((hub) => hub.code === route.dest)?.name ?? route.dest]);
    const rider = opts.rider ?? pick(rand, ridersByHub(route.dest));
    const senderIndex = opts.senderIndex ?? Math.floor(rand() * SENDER_COMPANIES.length);
    const cod = opts.cod ?? codAmount(rand, "normal");
    const seedKey = nextTracking();
    const row: Row<Parcel> & { seedKey: string } = {
      seedKey,
      trackingId: seedKey,
      senderName: SENDER_PEOPLE[senderIndex] ?? SENDER_PEOPLE[0]!,
      senderCompany: SENDER_COMPANIES[senderIndex] ?? SENDER_COMPANIES[0]!,
      receiverName: opts.receiverName ?? personName(rand),
      receiverPhone: phone(rand),
      receiverAddress: address(rand, area),
      area,
      originHubCode: route.origin,
      destHubCode: route.dest,
      routeCode,
      riderId: undefined,
      riderName: rider.name,
      codAmount: cod,
      paymentType: cod > 0 ? "cod" : "prepaid",
      weightKg: Number((0.3 + rand() * 4).toFixed(1)),
      status: opts.status ?? "delivered",
      lastTouchedByName: rider.name,
      lastTouchedAt: new Date(dispatchedAt.getTime() + 6 * HOUR).toISOString(),
      dispatchedAt: dispatchedAt.toISOString(),
      promisedAt: new Date(dispatchedAt.getTime() + (route.origin.startsWith("CTG") || route.dest.startsWith("CTG") || route.dest === "SYL" || route.dest === "KHL" ? 48 : 24) * HOUR).toISOString()
    };
    parcels.push(row);
    return { row, rider, senderIndex };
  }

  // --- exception cases per plan --------------------------------------------------------
  for (const route of ROUTES) {
    const plan = PLAN[route.code] ?? {};
    for (const [typeKey, counts] of Object.entries(plan) as [ExceptionType, [number, number, number, number]][]) {
      counts.forEach((count, weekIndex) => {
        const weeksAgo = 3 - weekIndex; // 0 = current rolling week
        for (let index = 0; index < count; index += 1) {
          // Spread within the rolling week; keep the current week's cases in the last 6.5 days.
          const ageDays = weeksAgo * 7 + 0.3 + rand() * 6.4;
          const openedAt = new Date(now.getTime() - ageDays * DAY);
          const dispatchedAt = new Date(openedAt.getTime() - (4 + rand() * 20) * HOUR);
          const isStoryRoute = route.code === "MIR10-CTGGEC";
          const jashim = RIDER_SPECS[0]!;
          // On the story lane a third of failures sit with one rider; refused ones skew COD-heavy.
          const rider = isStoryRoute && rand() < 0.36 ? jashim : undefined;
          const cod = typeKey === "refused" ? (isStoryRoute && rand() < 0.76 ? 1000 + Math.round(rand() * 280) * 10 : codAmount(rand, "normal")) : codAmount(rand, "normal");
          const area = isStoryRoute && typeKey === "refused" && rand() < 0.4 ? "GEC Circle" : undefined;
          const { row: parcel, rider: assignedRider, senderIndex } = makeParcel(route.code, dispatchedAt, { cod, area, rider, status: "exception" });

          const hubStaff = HUB_STAFF[route.origin] ?? ["Hub Staff"];
          const opener = pick(rand, hubStaff);
          const openerId = `seed:${route.origin}:${opener.replaceAll(" ", "-").toLowerCase()}`;
          const slaDueAt = slaDueFor(typeKey, openedAt);
          const ageHours = ageDays * 24;
          const slaHours = EXCEPTION_TYPES[typeKey].slaHours;

          // Lifecycle: older cases are resolved; recent ones are live in various states.
          let status: ExceptionCase["status"];
          if (ageDays > 9) status = rand() < 0.94 ? "resolved" : "in_progress";
          else if (ageDays > 3) status = rand() < 0.6 ? "resolved" : rand() < 0.5 ? "in_progress" : "awaiting_ack";
          else status = rand() < 0.35 ? "open" : rand() < 0.65 ? "in_progress" : rand() < 0.5 ? "awaiting_ack" : "resolved";

          const caseKey = `EX-${String(openedAt.getFullYear()).slice(-2)}${String(openedAt.getMonth() + 1).padStart(2, "0")}${String(openedAt.getDate()).padStart(2, "0")}-${caseSeq++}`;
          const originTeam = teamForHub(route.origin);
          const destTeam = teamForHub(route.dest);

          // Ownership chain: opened at origin hub → care (for refused/disputed) → destination hub.
          let ownerName = opener;
          let ownerUserId = openerId;
          let ownerTeam = originTeam;
          let ownerSince = openedAt;
          const chain: { team: string; name: string; id: string; at: Date }[] = [];
          const transferToCare = typeKey === "refused" || typeKey === "disputed" || rand() < 0.35;
          const t1 = new Date(openedAt.getTime() + (1 + rand() * 5) * HOUR);
          if (transferToCare && ageHours > 2) {
            const agent = pick(rand, CARE_AGENTS);
            chain.push({ team: "care", name: agent, id: `seed:care:${agent.replaceAll(" ", "-").toLowerCase()}`, at: t1 });
          }
          const t2 = new Date((chain[0]?.at ?? openedAt).getTime() + (2 + rand() * 8) * HOUR);
          if ((typeKey === "refused" || typeKey === "delayed" || typeKey === "address_missing") && ageHours > 8 && route.origin !== route.dest) {
            const staff = pick(rand, HUB_STAFF[route.dest] ?? ["Hub Staff"]);
            chain.push({ team: destTeam, name: staff, id: `seed:${route.dest}:${staff.replaceAll(" ", "-").toLowerCase()}`, at: t2 });
          }

          events.push({
            caseKey,
            caseId: "",
            caseNumber: caseKey,
            type: "opened",
            actorUserId: openerId,
            actorName: opener,
            actorRole: "hub-staff",
            actorTeam: originTeam,
            toOwnerTeam: originTeam,
            toOwnerName: opener,
            message: `Case opened as “${EXCEPTION_TYPES[typeKey].label}” by ${opener} (${HUBS.find((h) => h.code === route.origin)?.name} hub). Owner: ${opener}.`,
            internal: false,
            occurredAt: openedAt.toISOString()
          });
          senderUpdates.push({
            caseKey,
            parcelKey: parcel.seedKey,
            caseId: "",
            caseNumber: caseKey,
            parcelId: "",
            trackingId: parcel.trackingId,
            status: "investigating",
            headline: "We are looking into a delivery issue",
            detail: `Your parcel ${parcel.trackingId} could not be delivered as planned (${EXCEPTION_TYPES[typeKey].label.toLowerCase()}). A named team member now owns the case.`,
            expectedResolutionAt: slaDueAt.toISOString(),
            occurredAt: openedAt.toISOString()
          });

          let pendingOwnerTeam: string | undefined;
          let transferRequestedByName: string | undefined;
          let transferRequestedAt: string | undefined;
          for (const [hopIndex, hop] of chain.entries()) {
            const isLastHop = hopIndex === chain.length - 1;
            const requestedAt = new Date(hop.at.getTime() - (0.3 + rand() * 1.5) * HOUR);
            events.push({
              caseKey,
              caseId: "",
              caseNumber: caseKey,
              type: "transfer_requested",
              actorUserId: ownerUserId,
              actorName: ownerName,
              actorTeam: ownerTeam,
              fromOwnerTeam: ownerTeam,
              fromOwnerName: ownerName,
              toOwnerTeam: hop.team,
              message: `${ownerName} asked ${hop.team === "care" ? "Customer care" : `${HUBS.find((h) => h.code === hop.team.slice(4))?.name} hub`} to take over. ${ownerName} remains the owner until they acknowledge.`,
              internal: true,
              occurredAt: requestedAt.toISOString()
            });
            if (isLastHop && status === "awaiting_ack") {
              pendingOwnerTeam = hop.team;
              transferRequestedByName = ownerName;
              transferRequestedAt = requestedAt.toISOString();
              break;
            }
            events.push({
              caseKey,
              caseId: "",
              caseNumber: caseKey,
              type: "transfer_acknowledged",
              actorUserId: hop.id,
              actorName: hop.name,
              actorTeam: hop.team,
              fromOwnerTeam: ownerTeam,
              fromOwnerName: ownerName,
              toOwnerTeam: hop.team,
              toOwnerName: hop.name,
              message: `${hop.name} acknowledged and took ownership for ${hop.team === "care" ? "Customer care" : `${HUBS.find((h) => h.code === hop.team.slice(4))?.name} hub`} (from ${ownerName}).`,
              internal: false,
              occurredAt: hop.at.toISOString()
            });
            ownerName = hop.name;
            ownerUserId = hop.id;
            ownerTeam = hop.team;
            ownerSince = hop.at;
          }
          if (status === "awaiting_ack" && !pendingOwnerTeam) status = "in_progress";

          // Rider note + structured incident on ~55% of cases.
          let incident: ReturnType<typeof structureRiderNote> | undefined;
          let nextStep: NextStep | undefined;
          let nextStepStatus: ExceptionCase["nextStepStatus"] = "none";
          if (rand() < 0.55) {
            const raw = pick(rand, RIDER_NOTES[typeKey]);
            incident = structureRiderNote(raw, { caseType: typeKey, codAmount: cod, area: parcel.area });
            const noteAt = new Date(openedAt.getTime() + (0.5 + rand() * 3) * HOUR);
            const confirmed = status === "resolved" || (status === "in_progress" && rand() < 0.6);
            nextStep = incident.recommendedAction;
            nextStepStatus = confirmed ? "confirmed" : incident.needsManualReview ? "manual_review" : "recommended";
            notes.push({
              caseKey,
              parcelKey: parcel.seedKey,
              caseId: "",
              caseNumber: caseKey,
              parcelId: "",
              trackingId: parcel.trackingId,
              riderName: assignedRider.name,
              rawText: raw,
              language: "banglish",
              structuredJson: JSON.stringify(incident),
              recommendedAction: incident.recommendedAction,
              confidence: incident.confidence,
              source: "heuristic",
              status: confirmed ? "confirmed" : incident.needsManualReview ? "manual_review" : "structured",
              confirmedByName: confirmed ? pick(rand, CARE_AGENTS) : undefined,
              confirmedAt: confirmed ? new Date(noteAt.getTime() + HOUR).toISOString() : undefined,
              submittedAt: noteAt.toISOString()
            });
            events.push({ caseKey, caseId: "", caseNumber: caseKey, type: "rider_note", actorUserId: `seed:rider:${assignedRider.code}`, actorName: assignedRider.name, actorRole: "rider", message: `Rider note from ${assignedRider.name}: “${raw}”`, internal: true, occurredAt: noteAt.toISOString() });
            events.push({
              caseKey,
              caseId: "",
              caseNumber: caseKey,
              type: "ai_structured",
              actorUserId: "system:desk-ai",
              actorName: "Desk AI",
              actorRole: "system",
              message: `Structured the rider note: ${incident.summary} Recommended: ${incident.recommendedAction.replaceAll("_", " ")} (${Math.round(incident.confidence * 100)}% confidence).`,
              internal: true,
              payloadJson: JSON.stringify(incident),
              occurredAt: new Date(noteAt.getTime() + 20_000).toISOString()
            });
            if (confirmed) {
              const agent = pick(rand, CARE_AGENTS);
              events.push({ caseKey, caseId: "", caseNumber: caseKey, type: "next_step_confirmed", actorUserId: `seed:care:${agent}`, actorName: agent, actorRole: "care-agent", actorTeam: "care", message: `${agent} confirmed the next step: ${incident.recommendedAction.replaceAll("_", " ")}.`, internal: false, occurredAt: new Date(noteAt.getTime() + HOUR).toISOString() });
              senderUpdates.push({ caseKey, parcelKey: parcel.seedKey, caseId: "", caseNumber: caseKey, parcelId: "", trackingId: parcel.trackingId, status: "action_planned", headline: incident.senderSafeSummary.split(". ")[0] + ".", detail: incident.senderSafeSummary, nextAction: incident.recommendedAction.replaceAll("_", " "), expectedResolutionAt: new Date(noteAt.getTime() + 24 * HOUR).toISOString(), occurredAt: new Date(noteAt.getTime() + HOUR).toISOString() });
            }
          } else if (rand() < 0.5) {
            nextStep = pick(rand, NEXT_STEP_FOR[typeKey]);
            nextStepStatus = status === "resolved" ? "confirmed" : "recommended";
          }

          const breachedNow = status !== "resolved" && ageHours > slaHours;
          let resolvedAt: string | undefined;
          let resolution: string | undefined;
          if (status === "resolved") {
            const resolveHours = Math.min(ageHours - 0.5, slaHours * (rand() < 0.78 ? 0.4 + rand() * 0.55 : 1.1 + rand() * 0.8));
            const resolvedDate = new Date(openedAt.getTime() + Math.max(resolveHours, 1) * HOUR);
            resolvedAt = resolvedDate.toISOString();
            const outcome = typeKey === "damaged" ? "claimed" : nextStep === "return_to_sender" || (typeKey === "refused" && rand() < 0.45) ? "returned" : "delivered";
            resolution = outcome === "delivered" ? `Delivered on redelivery by ${assignedRider.name}${cod ? `; COD ৳${cod.toLocaleString("en-BD")} collected` : ""}.` : outcome === "returned" ? "Returned to sender via origin hub." : "Damage claim approved; credit issued to merchant.";
            parcel.status = outcome === "delivered" ? "delivered" : "returned";
            events.push({ caseKey, caseId: "", caseNumber: caseKey, type: "resolved", actorUserId: ownerUserId, actorName: ownerName, actorTeam: ownerTeam, message: `Resolved by ${ownerName}: ${resolution}`, internal: false, occurredAt: resolvedAt });
            senderUpdates.push({ caseKey, parcelKey: parcel.seedKey, caseId: "", caseNumber: caseKey, parcelId: "", trackingId: parcel.trackingId, status: outcome === "returned" ? "returned" : "resolved", headline: outcome === "delivered" ? "Delivered" : outcome === "returned" ? "Returned to you" : "Claim approved", detail: outcome === "delivered" ? `Parcel ${parcel.trackingId} has been delivered.` : outcome === "returned" ? `Parcel ${parcel.trackingId} is on its way back to you.` : `Your claim for parcel ${parcel.trackingId} has been approved.`, occurredAt: resolvedAt });
            if (resolveHours > slaHours) {
              events.push({ caseKey, caseId: "", caseNumber: caseKey, type: "sla_breached", actorUserId: "system:sla", actorName: "SLA monitor", actorRole: "system", message: `SLA breached: no resolution ${slaHours}h after opening.`, internal: true, occurredAt: slaDueAt.toISOString() });
            }
          } else if (breachedNow) {
            events.push({ caseKey, caseId: "", caseNumber: caseKey, type: "sla_breached", actorUserId: "system:sla", actorName: "SLA monitor", actorRole: "system", message: `SLA breached: no resolution ${slaHours}h after opening. Owner ${ownerName} notified.`, internal: true, occurredAt: slaDueAt.toISOString() });
          }

          const slaBreached = status === "resolved" ? new Date(resolvedAt!).getTime() > slaDueAt.getTime() : breachedNow;

          cases.push({
            seedKey: caseKey,
            parcelKey: parcel.seedKey,
            caseNumber: caseKey,
            parcelId: "",
            trackingId: parcel.trackingId,
            type: typeKey,
            status,
            priority: slaBreached ? "high" : cod >= 2000 || typeKey === "damaged" ? "high" : "normal",
            hubCode: ownerTeam.startsWith("hub:") ? ownerTeam.slice(4) : route.origin,
            originHubCode: route.origin,
            destHubCode: route.dest,
            routeCode: route.code,
            riderName: assignedRider.name,
            codAmount: cod,
            openedByUserId: openerId,
            openedByName: opener,
            openedAt: openedAt.toISOString(),
            ownerUserId,
            ownerName,
            ownerTeam,
            ownerSince: ownerSince.toISOString(),
            pendingOwnerTeam,
            transferRequestedByName,
            transferRequestedAt,
            transferNote: pendingOwnerTeam ? "Please take over from here. Receiver details confirmed." : undefined,
            slaDueAt: slaDueAt.toISOString(),
            slaBreached,
            slaBreachedAt: slaBreached ? slaDueAt.toISOString() : undefined,
            nextStep,
            nextStepStatus,
            nextStepConfidence: incident?.confidence,
            nextStepSource: incident ? "heuristic" : nextStep ? "human" : undefined,
            incidentJson: incident ? JSON.stringify(incident) : undefined,
            resolution,
            resolvedAt,
            seedTag: SEED_TAG
          });
          void senderIndex;
        }
      });
    }
  }

  // --- routine parcels in flight (pre-call candidates) ---------------------------------------
  for (const route of ROUTES) {
    const count = route.code === "MIR10-CTGGEC" ? 18 : 5;
    for (let index = 0; index < count; index += 1) {
      const dispatchedAt = new Date(now.getTime() - (rand() * 30) * HOUR);
      makeParcel(route.code, dispatchedAt, {
        status: rand() < 0.5 ? "in_transit" : "out_for_delivery",
        cod: route.code === "MIR10-CTGGEC" ? codAmount(rand, "high") : codAmount(rand, "normal")
      });
    }
  }

  // --- the scripted demo parcel: COD ৳2,300, Mirpur 10 → Chattogram GEC, rider Jashim -----
  const demo = makeParcel("MIR10-CTGGEC", new Date(now.getTime() - 26 * HOUR), {
    cod: 2300,
    area: "GEC Circle",
    rider: RIDER_SPECS[0],
    status: "out_for_delivery",
    receiverName: "Farhana Akter",
    senderIndex: 0
  });
  demo.row.receiverAddress = "House 7, Road 3 (beside two black buildings), GEC Circle";
  demo.row.lastTouchedByName = RIDER_SPECS[0]!.name;
  demo.row.lastTouchedAt = new Date(now.getTime() - 2 * HOUR).toISOString();

  return { riders, parcels, cases, events, notes, senderUpdates, demoTrackingId: demo.row.trackingId };
}
