import type { NextStep } from "@/features/domain/types";
import type { AddressQuality, Evidence, FailureReason, IncidentSummary, NoteContext, PhoneStatus, PreferredWindow } from "./types";

// Deterministic Banglish → structured incident engine.
//
// Riders write the way they speak: romanised Bangla mixed with English, no
// punctuation, phonetic spellings ("korsi" / "korechi" / "korlam"). The engine
// works on a normalised token stream with a lexicon of spelling variants and
// scores every signal it finds, so the confidence it reports is earned, not
// asserted. It runs identically in the browser and on the server, and it is
// what the desk falls back to when no LLM key is configured -- and the
// independent second opinion when one is.

const BANGLA_NUMBERS: Record<string, number> = {
  ek: 1, akta: 1, ekta: 1, ekbar: 1,
  dui: 2, duibar: 2, duita: 2, "2ta": 2,
  tin: 3, tinbar: 3, tinta: 3, "3ta": 3,
  char: 4, charbar: 4,
  panch: 5, pach: 5, panchbar: 5,
  choy: 6, chhoy: 6,
  "1st": 1, "2nd": 2, "3rd": 3, "4th": 4,
  first: 1, second: 2, third: 3, fourth: 4,
  once: 1, twice: 2, thrice: 3
};

type Rule = { id: string; label: string; pattern: RegExp; weight: number };

const ATTEMPT_RULES: Rule[] = [
  { id: "attempt-count", label: "delivery attempts", weight: 0.9, pattern: /\b(\d{1,2}|ek|dui|tin|char|panch|pach|choy|1st|2nd|3rd|first|second|third|twice|thrice)\s*(?:ta\s*)?(?:bar|time|times|try|tries|attempt|attempts|trip)\b/i },
  { id: "attempt-again", label: "repeated attempt", weight: 0.5, pattern: /\b(abar|again|aabar|arekbar|arek\s*bar|barbar|bar\s*bar)\b/i },
  { id: "attempt-went", label: "went to address", weight: 0.3, pattern: /\b(gesi|gechi|gelam|giyechi|giyechilam|gesilam|went|visited|pouchechi|pouchesi)\b/i }
];

const PHONE_OFF: Rule[] = [
  { id: "phone-off", label: "phone switched off", weight: 0.9, pattern: /\b(phone|mobile|number|num|fon|cell)\s*(?:ta\s*)?(off|bondho|bondo|bondh|switch(?:ed)?\s*off|band|closed?)\b/i },
  { id: "phone-off-2", label: "phone switched off", weight: 0.85, pattern: /\b(switch(?:ed)?\s*off|off\s*ase|off\s*ache|off\s*chilo|bondho\s*ase|bondho\s*chilo|not\s*reachable|unreachable|out\s*of\s*reach)\b/i }
];
const PHONE_UNANSWERED: Rule[] = [
  { id: "phone-noanswer", label: "calls unanswered", weight: 0.8, pattern: /\b(dhore\s*na|dhorche\s*na|dhorlo\s*na|dhorse\s*na|dhortese\s*na|receive\s*kore\s*na|receive\s*korlo\s*na|kore\s*nai|tole\s*na|tulche\s*na|tullo\s*na|tolena|no\s*answer|not\s*picking|not\s*answering|didn'?t\s*pick|ring\s*(?:hoy|hocche|hoitese|hoise)|kete\s*dey|kete\s*dilo|cut\s*kore|busy\s*dekhay|busy\s*bole)\b/i }
];
const PHONE_WRONG: Rule[] = [
  { id: "phone-wrong", label: "wrong number", weight: 0.85, pattern: /\b(number|num|phone|nambar)\s*(?:ta\s*)?(vul|bhul|wrong|invalid|onno\s*manush|onno\s*lok|nai\s*ei|exist\s*kore\s*na)\b|\bwrong\s*number\b/i }
];

const REFUSAL_RULES: Rule[] = [
  { id: "refuse-firm", label: "receiver refused firmly", weight: 0.9, pattern: /\b(nibe\s*na|nibo\s*na|niben\s*na|nite\s*chay\s*na|nite\s*chai\s*na|nite\s*chacche\s*na|nilo\s*na|nen\s*nai|nilo\s*nai|refuse[ds]?|rejected?|reject\s*kor(?:lo|se|eche)|cancel\s*kor(?:te\s*bolse|lo|se|eche)|cancel\s*bolse|return\s*koro|ferot\s*dao|ferot\s*pathao|ferot\s*niye\s*jao|lagbe\s*na)\b/i },
  { id: "refuse-notordered", label: "says they did not order", weight: 0.8, pattern: /\b(order\s*(?:kore|kori|dei|dey|di)\s*nai|order\s*kore\s*ni|didn'?t\s*order|did\s*not\s*order|amar\s*na|amar\s*order\s*na|onno\s*jinish|wrong\s*(?:item|product)|different\s*(?:item|product)|vul\s*product|bhul\s*product)\b/i },
  { id: "refuse-price", label: "price / COD dispute", weight: 0.7, pattern: /\b(dam\s*beshi|price\s*beshi|beshi\s*dam|expensive|dam\s*niye|price\s*niye|taka\s*beshi|amount\s*beshi|dam\s*match\s*kore\s*na|2\s*(?:ta|bar)\s*dam)\b/i }
];

const COD_RULES: Rule[] = [
  { id: "cod-cash", label: "COD cash not available", weight: 0.85, pattern: /\b(taka\s*nai|tk\s*nai|cash\s*nai|taka\s*ready\s*nai|ready\s*nai|cash\s*ready\s*nai|taka\s*nei|money\s*nai|cod\s*(?:ready\s*)?nai|cod\s*dite\s*parbe\s*na|cod\s*dibe\s*na|taka\s*dite\s*parbe\s*na|taka\s*dibe\s*na|payment\s*dite\s*parbe\s*na|salary\s*pai\s*nai|salary\s*hoy\s*nai|bkash\s*e\s*dite\s*chay|bkash\s*korbe|pore\s*dibe|taka\s*pore\s*dibe|no\s*cash|cash\s*nei)\b/i },
  { id: "cod-mention", label: "COD amount mentioned", weight: 0.35, pattern: /\b(cod|cash\s*on\s*delivery|taka|tk|৳|bdt)\s*\d{2,6}\b|\b\d{2,6}\s*(taka|tk|৳)\b/i }
];

const ADDRESS_WRONG: Rule[] = [
  { id: "addr-wrong", label: "address wrong", weight: 0.85, pattern: /\b(address|thikana|thikna|location|map|pin)\s*(?:ta\s*)?(vul|bhul|wrong|incorrect|mismatch|match\s*kore\s*na|onno\s*jaygay|onno\s*jayga|onno\s*area|onno\s*elakay)\b|\b(vul|bhul|wrong)\s*(address|thikana|location)\b|\bonno\s*(?:jaygar|jaygay|elakar)\s*(address|thikana)\b/i }
];
const ADDRESS_NOTFOUND: Rule[] = [
  { id: "addr-notfound", label: "address not found", weight: 0.8, pattern: /\b(address|thikana|thikna|bari|basha|building|house|flat|location|jayga|gali|goli|road)\s*(?:ta\s*)?(pai\s*nai|paini|pai\s*ni|khuje\s*pai\s*nai|khuje\s*pai\s*ni|khuje\s*paini|paoa\s*jay\s*nai|pawa\s*jay\s*na|milena|mile\s*na|mile\s*nai|chine\s*na|chini\s*na|not\s*found|can'?t\s*find|couldn'?t\s*find)\b|\b(khuje\s*pai\s*nai|khuje\s*paini|pai\s*nai\s*address|address\s*pai\s*nai|not\s*found)\b/i }
];
const ADDRESS_INCOMPLETE: Rule[] = [
  { id: "addr-incomplete", label: "house / road number missing", weight: 0.8, pattern: /\b(house|bari|basha|flat|road|rasta|block|sector|floor|tala)\s*(?:number|no|num|nambar)?\s*(?:ta\s*)?(nai|nei|deya\s*nai|dey\s*nai|missing|nothing|lekha\s*nai|nai\s*address\s*e)\b|\b(house|road)\s*(?:number|no)\s*missing\b|\bincomplete\s*address\b|\baddress\s*incomplete\b|\bonly\s*area\b|\bshudhu\s*(?:area|elaka)\b/i }
];
const ADDRESS_VAGUE: Rule[] = [
  { id: "addr-vague", label: "vague landmark-only address", weight: 0.7, pattern: /\b(\d+\s*ta\s*|dui\s*ta\s*|tin\s*ta\s*|2\s*ta\s*|3\s*ta\s*)?(kalo|holud|shada|lal|nil|sobuj|boro|choto|notun|purano|new|old|black|yellow|white|red|blue|green|big|small)\s*(building|bari|basha|gate|tower|dokan|mosjid|masjid|school|hospital|market|bazar|bazaar|road|gali|goli|gate)\b|\b(pashe|pase|shamne|samne|samner|opposite|piche|pichone|beside|near|kache|kachhe|er\s*pashe|er\s*pase|er\s*shamne|er\s*piche)\b/i }
];
const LANDMARK_PATTERN = /\b((?:\d+\s*ta\s*|dui\s*ta\s*|tin\s*ta\s*|2\s*ta\s*|3\s*ta\s*)?(?:kalo|holud|shada|lal|nil|sobuj|boro|choto|notun|purano|new|old|black|yellow|white|red|blue|green|big|small)\s*(?:building|bari|basha|gate|tower|dokan|mosjid|masjid|school|hospital|market|bazar|bazaar|road|gali|goli|gate)|(?:[A-Za-z]+\s+)?(?:mosjid|masjid|mosque|school|college|madrasa|hospital|clinic|pharmacy|farmacy|bazar|bazaar|market|super\s*shop|tower|plaza|complex|moar|more|circle|gate|goli|gali|lane|field|math|park|petrol\s*pump|pump|bank|atm|bus\s*stand|counter|rail\s*gate|thana|police\s*box))\b/gi;

const ACCESS_RULES: Rule[] = [
  { id: "access-guard", label: "guard / security refused entry", weight: 0.85, pattern: /\b(guard|gaurd|darowan|darwan|security|caretaker|care\s*taker|watchman|gatekeeper|reception)\s*(?:ta\s*|ra\s*|e\s*)?(dhukte\s*dey\s*na|dhukte\s*dei\s*na|dhukte\s*dilo\s*na|dhukte\s*dise\s*na|dhukte\s*deyna|dukte\s*dey\s*na|dukte\s*dei\s*na|dukte\s*dilo\s*na|jete\s*dey\s*na|jete\s*dilo\s*na|allow\s*kore\s*na|allow\s*korlo\s*na|niche\s*rakhte\s*bolse|niche\s*rekhe\s*jete\s*bolse|nite\s*chay\s*na|receive\s*korbe\s*na|receive\s*kore\s*na|entry\s*dey\s*na|entry\s*dilo\s*na|bad\s*behave|bad\s*behaviour)\b|\b(dhukte|dukte)\s*(?:dey|dei|dilo|dise)\s*na\b|\bentry\s*(?:dey|dilo)\s*na\b|\bno\s*entry\b/i },
  { id: "access-gate", label: "gate locked / building closed", weight: 0.7, pattern: /\b(gate|door|dorja|office|building|lift)\s*(?:ta\s*)?(bondho|bondo|lock|locked|closed|off|nai|chilo\s*na)\b|\bgate\s*lock\b/i }
];

const UNAVAILABLE_RULES: Rule[] = [
  { id: "unavail-home", label: "receiver not at home", weight: 0.8, pattern: /\b(bashay\s*nai|basay\s*nai|bashae\s*nai|basae\s*nai|ghore\s*nai|bari\s*nai|bariте\s*nai|barite\s*nai|home\s*e\s*nai|not\s*(?:at\s*)?home|not\s*available|available\s*na|available\s*nai|baire\s*(?:ase|ache|gese|geche|chilo)|baire\s*gese|office\s*e\s*(?:ase|ache|chilo)|office\s*e\b|kaje\s*(?:ase|ache|gese)|dhaka(?:r)?\s*baire|shohorer\s*baire|deshe\s*(?:gese|geche)|gramer\s*bari|village\s*e|elakay\s*nai|out\s*of\s*(?:town|dhaka|station))\b/i }
];

const WINDOW_RULES: { window: PreferredWindow; label: string; pattern: RegExp; weight: number }[] = [
  { window: "evening", label: "evening availability", weight: 0.9, pattern: /\b(shondha|sondha|shondhay|sondhay|shondhya|sondhya|sandhya|shondhar\s*por|evening|eve|after\s*6|after\s*7|after\s*8|6\s*tar\s*por|7\s*tar\s*por|8\s*tar\s*por|6pm|7pm|8pm|6\s*pm|7\s*pm|8\s*pm|maghrib(?:er)?\s*por|magrib(?:er)?\s*por|iftar(?:er)?\s*por|office\s*(?:er\s*)?por|office\s*theke\s*fire|fire\s*ashbe|firbe|ferar\s*por|bikal(?:er)?\s*por|bikeler\s*por|bikele\s*por)\b/i },
  { window: "night", label: "night availability", weight: 0.7, pattern: /\b(raat|rat\s*e|raate|rate\s*|night|9\s*tar\s*por|10\s*tar\s*por|9pm|10pm|9\s*pm|10\s*pm|after\s*9|after\s*10|esha(?:r)?\s*por)\b/i },
  { window: "morning", label: "morning availability", weight: 0.7, pattern: /\b(sokal|sokale|shokal|shokale|morning|sokal\s*bela|10\s*tar\s*age|before\s*10|before\s*11|9am|10am|9\s*am|10\s*am|fajr(?:er)?\s*por)\b/i },
  { window: "afternoon", label: "afternoon availability", weight: 0.6, pattern: /\b(dupur|dupure|noon|afternoon|bikal|bikale|bikel|bikele|2\s*tar\s*por|3\s*tar\s*por|4\s*tar\s*por|lunch(?:er)?\s*por|2pm|3pm|4pm)\b/i },
  { window: "tomorrow", label: "asked for tomorrow", weight: 0.7, pattern: /\b(kal|kalke|kaal|kalka|agamikal|agami\s*kal|tomorrow|tmrw|next\s*day|porshu|porshudin|day\s*after)\b/i },
  { window: "weekend", label: "weekend availability", weight: 0.7, pattern: /\b(shukrobar|shukro\s*bar|shukrobare|friday|shonibar|shoni\s*bar|saturday|weekend|chuti(?:r)?\s*din|holiday)\b/i }
];

const RESCHEDULE_RULES: Rule[] = [
  { id: "resched", label: "receiver asked to reschedule", weight: 0.75, pattern: /\b(pore\s*(?:dite|ashte|asen|ashen|call\s*dite|nibe|nite)\s*bol(?:se|lo|eche|che)|pore\s*call\s*d(?:ite|ao|en)|later\s*dite\s*bolse|kal\s*(?:dite|ashte|asen|nibe)\s*bol(?:se|lo|eche)|reschedule|re-?schedule|onno\s*din|another\s*day|onno\s*time|another\s*time|somoy\s*nai|time\s*nai|ekhon\s*(?:parbe|parbo)\s*na|ekhon\s*na|busy\s*ase|busy\s*ache|meeting\s*e|call\s*dite\s*bolse|call\s*kore\s*ashte\s*bolse|age\s*call\s*dite)\b/i }
];

const DAMAGE_RULES: Rule[] = [
  { id: "damage", label: "parcel damaged", weight: 0.9, pattern: /\b(vanga|bhanga|venge\s*gese|bhenge\s*gese|venge|bhenge|broken|damage[ds]?|damej|leak|leaked|leaking|leak\s*korse|chera|chhera|torn|bhije|vije|bhija|vija|wet|dent|crush(?:ed)?|packet\s*(?:khola|open|nosto)|box\s*(?:vanga|bhanga|nosto|khola)|nosto|noshto|spoiled|expired)\b/i }
];

const RTS_RULES: Rule[] = [
  { id: "rts", label: "rider suggests return", weight: 0.6, pattern: /\b(rts|return\s*to\s*sender|return\s*kori|return\s*kore\s*dei|return\s*dite\s*hobe|hub\s*e\s*(?:ferot|return|niye\s*jai|niye\s*aslam|niye\s*asi)|ferot\s*(?:niye|nie)\s*(?:aslam|asi|ashi)|ferot\s*anlam|niye\s*aslam|niye\s*asi|back\s*to\s*hub)\b/i }
];

function normalize(text: string): string {
  return text
    .replace(/[\u0980-\u09FF]+/g, (bangla) => ` ${bangla} `)
    .replace(/[“”"']/g, "")
    .replace(/[.,;:!?()\[\]{}\-–—/\\|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function firstMatch(rules: Rule[], text: string): { rule: Rule; match: RegExpMatchArray } | undefined {
  for (const rule of rules) {
    const match = text.match(rule.pattern);
    if (match) return { rule, match };
  }
  return undefined;
}

function allMatches(rules: Rule[], text: string): { rule: Rule; match: RegExpMatchArray }[] {
  const found: { rule: Rule; match: RegExpMatchArray }[] = [];
  for (const rule of rules) {
    const match = text.match(rule.pattern);
    if (match) found.push({ rule, match });
  }
  return found;
}

function quote(match: RegExpMatchArray | undefined, fallback = ""): string {
  return (match?.[0] ?? fallback).trim();
}

function parseAttempts(text: string, evidence: Evidence[]): number | null {
  const counted = text.match(ATTEMPT_RULES[0]!.pattern);
  if (counted) {
    const token = counted[1]!.toLowerCase();
    const value = /^\d+$/.test(token) ? Number(token) : BANGLA_NUMBERS[token];
    if (value && value > 0 && value < 20) {
      evidence.push({ label: `${value} delivery attempt${value === 1 ? "" : "s"}`, quote: quote(counted), weight: 0.9 });
      return value;
    }
  }
  const again = text.match(ATTEMPT_RULES[1]!.pattern);
  if (again) {
    evidence.push({ label: "repeated attempt", quote: quote(again), weight: 0.5 });
    return 2;
  }
  const went = text.match(ATTEMPT_RULES[2]!.pattern);
  if (went) {
    evidence.push({ label: "went to the address", quote: quote(went), weight: 0.3 });
    return 1;
  }
  return null;
}

type RuleHit = { rule: Rule; match: RegExpMatchArray } | undefined;

function classifyAddress(
  hits: { addrWrong: RuleHit; addrNotFound: RuleHit; addrIncomplete: RuleHit; addrVague: RuleHit; landmarks: string[] },
  evidence: Evidence[]
): AddressQuality {
  if (hits.addrWrong) {
    evidence.push({ label: "address wrong", quote: quote(hits.addrWrong.match), weight: hits.addrWrong.rule.weight });
    return "wrong";
  }
  if (hits.addrIncomplete) {
    evidence.push({ label: "address incomplete", quote: quote(hits.addrIncomplete.match), weight: hits.addrIncomplete.rule.weight });
    return "incomplete";
  }
  if (hits.addrNotFound) {
    evidence.push({ label: "address not found", quote: quote(hits.addrNotFound.match), weight: hits.addrNotFound.rule.weight });
    return hits.landmarks.length ? "vague" : "incomplete";
  }
  if (hits.addrVague || hits.landmarks.length >= 1) {
    if (hits.addrVague) evidence.push({ label: "landmark-only directions", quote: quote(hits.addrVague.match), weight: hits.addrVague.rule.weight });
    return "vague";
  }
  return "unknown";
}

function extractLandmarks(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(LANDMARK_PATTERN)) {
    const value = match[0].trim().replace(/\s+/g, " ");
    if (value.length >= 4) found.add(value);
    if (found.size >= 4) break;
  }
  return [...found];
}

const REASON_LABEL: Record<FailureReason, string> = {
  customer_unreachable: "receiver could not be reached by phone",
  refused: "receiver refused the parcel",
  address_issue: "address could not be located",
  access_denied: "rider was not allowed into the building",
  customer_unavailable: "receiver was not at the address",
  damaged: "parcel is damaged",
  reschedule_requested: "receiver asked to reschedule",
  unknown: "reason unclear from the note"
};

const WINDOW_LABEL: Record<PreferredWindow, string> = {
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening (after 6 pm)",
  night: "late evening (after 9 pm)",
  tomorrow: "tomorrow",
  weekend: "the weekend"
};

const ACTION_SENDER_SAFE: Record<NextStep, string> = {
  evening_redelivery: "A redelivery attempt is being scheduled for the evening.",
  call_customer: "Our care team is contacting the receiver to arrange delivery.",
  return_to_sender: "The receiver declined the parcel; it is being prepared for return to you.",
  courier_claim: "The parcel was damaged in transit. A claim is being opened on your behalf.",
  address_verification: "We are confirming the exact delivery address with the receiver.",
  manual_review: "Our team is reviewing this delivery and will update you shortly."
};

export function structureRiderNote(rawText: string, context: NoteContext = {}): IncidentSummary {
  const text = normalize(rawText);
  const evidence: Evidence[] = [];
  const rationale: string[] = [];

  // --- signals ---------------------------------------------------------------
  const attempts = parseAttempts(text, evidence) ?? (context.previousAttempts ?? null);

  let phoneStatus: PhoneStatus = "unknown";
  const phoneOff = firstMatch(PHONE_OFF, text);
  const phoneNoAnswer = firstMatch(PHONE_UNANSWERED, text);
  const phoneWrong = firstMatch(PHONE_WRONG, text);
  if (phoneWrong) {
    phoneStatus = "wrong_number";
    evidence.push({ label: "wrong phone number", quote: quote(phoneWrong.match), weight: phoneWrong.rule.weight });
  } else if (phoneOff) {
    phoneStatus = "off";
    evidence.push({ label: "phone switched off", quote: quote(phoneOff.match), weight: phoneOff.rule.weight });
  } else if (phoneNoAnswer) {
    phoneStatus = "unanswered";
    evidence.push({ label: "calls unanswered", quote: quote(phoneNoAnswer.match), weight: phoneNoAnswer.rule.weight });
  }

  const refusals = allMatches(REFUSAL_RULES, text);
  for (const item of refusals) evidence.push({ label: item.rule.label, quote: quote(item.match), weight: item.rule.weight });
  const refusalFirm = refusals.some((item) => item.rule.id === "refuse-firm" || item.rule.id === "refuse-notordered");

  const codMatches = allMatches(COD_RULES, text);
  const codIssue = codMatches.some((item) => item.rule.id === "cod-cash") || (refusals.some((item) => item.rule.id === "refuse-price") && (context.codAmount ?? 0) > 0);
  for (const item of codMatches) if (item.rule.id === "cod-cash") evidence.push({ label: item.rule.label, quote: quote(item.match), weight: item.rule.weight });

  const addrWrong = firstMatch(ADDRESS_WRONG, text);
  const addrNotFound = firstMatch(ADDRESS_NOTFOUND, text);
  const addrIncomplete = firstMatch(ADDRESS_INCOMPLETE, text);
  const addrVague = firstMatch(ADDRESS_VAGUE, text);
  const landmarks = extractLandmarks(text);
  const addressQuality = classifyAddress({ addrWrong, addrNotFound, addrIncomplete, addrVague, landmarks }, evidence);
  if (landmarks.length) evidence.push({ label: "landmarks mentioned", quote: landmarks.join(", "), weight: 0.4 });

  const access = firstMatch(ACCESS_RULES, text);
  if (access) evidence.push({ label: access.rule.label, quote: quote(access.match), weight: access.rule.weight });

  const unavailable = firstMatch(UNAVAILABLE_RULES, text);
  if (unavailable) evidence.push({ label: unavailable.rule.label, quote: quote(unavailable.match), weight: unavailable.rule.weight });

  const windows = WINDOW_RULES.map((rule) => ({ rule, match: text.match(rule.pattern) })).filter((item) => item.match);
  const availabilityHints = windows.map((item) => `${WINDOW_LABEL[item.rule.window]} — “${quote(item.match!)}”`);
  for (const item of windows) evidence.push({ label: item.rule.label, quote: quote(item.match!), weight: item.rule.weight });
  const preferredWindow: PreferredWindow | null =
    windows.find((item) => item.rule.window === "evening")?.rule.window ??
    windows.find((item) => item.rule.window === "night")?.rule.window ??
    windows.find((item) => item.rule.window === "morning" || item.rule.window === "afternoon")?.rule.window ??
    windows.find((item) => item.rule.window === "weekend")?.rule.window ??
    windows.find((item) => item.rule.window === "tomorrow")?.rule.window ??
    null;

  const reschedule = firstMatch(RESCHEDULE_RULES, text);
  if (reschedule) evidence.push({ label: reschedule.rule.label, quote: quote(reschedule.match), weight: reschedule.rule.weight });

  const damage = firstMatch(DAMAGE_RULES, text);
  if (damage) evidence.push({ label: damage.rule.label, quote: quote(damage.match), weight: damage.rule.weight });

  const rts = firstMatch(RTS_RULES, text);
  if (rts) evidence.push({ label: rts.rule.label, quote: quote(rts.match), weight: rts.rule.weight });

  // --- primary reason ------------------------------------------------------------
  const scores: Partial<Record<FailureReason, number>> = {};
  const bump = (reason: FailureReason, value: number) => {
    scores[reason] = (scores[reason] ?? 0) + value;
  };
  if (damage) bump("damaged", 1.0);
  if (refusalFirm) bump("refused", 1.0);
  if (refusals.some((item) => item.rule.id === "refuse-price")) bump("refused", 0.6);
  if (codIssue) bump("refused", 0.45);
  if (phoneStatus === "off" || phoneStatus === "wrong_number") bump("customer_unreachable", 0.8);
  if (phoneStatus === "unanswered") bump("customer_unreachable", 0.65);
  if (addressQuality === "wrong") bump("address_issue", 0.95);
  if (addressQuality === "incomplete") bump("address_issue", 0.85);
  if (addressQuality === "vague" && (addrNotFound || addrVague)) bump("address_issue", 0.6);
  if (access) bump("access_denied", 0.85);
  if (unavailable) bump("customer_unavailable", 0.75);
  if (reschedule) bump("reschedule_requested", 0.7);
  if (preferredWindow && !refusalFirm && !damage) bump("customer_unavailable", 0.25);
  if (context.caseType === "refused" && (codIssue || refusals.length)) bump("refused", 0.3);
  if (context.caseType === "damaged" && damage) bump("damaged", 0.3);
  if (context.caseType === "address_missing" && addressQuality !== "unknown" && addressQuality !== "good") bump("address_issue", 0.3);

  const ranked = (Object.entries(scores) as [FailureReason, number][]).sort((a, b) => b[1] - a[1]);
  const failureReason: FailureReason = ranked[0]?.[0] ?? "unknown";
  const secondaryReasons = ranked.slice(1).filter(([, score]) => score >= 0.45).map(([reason]) => reason).slice(0, 3);

  // --- recommendation -------------------------------------------------------------
  let recommendedAction: NextStep = "manual_review";
  if (failureReason === "damaged") {
    recommendedAction = "courier_claim";
    rationale.push("Damage reported by the rider → open a courier claim rather than retry delivery.");
  } else if (failureReason === "refused" && refusalFirm && !preferredWindow && !codIssue) {
    recommendedAction = "return_to_sender";
    rationale.push("Receiver refused firmly with no reschedule signal → return to sender.");
  } else if (failureReason === "refused" && refusalFirm && (attempts ?? 0) >= 3) {
    recommendedAction = "return_to_sender";
    rationale.push(`${attempts} attempts and a firm refusal → further attempts are unlikely to convert.`);
  } else if (preferredWindow === "evening" || preferredWindow === "night") {
    recommendedAction = "evening_redelivery";
    rationale.push(`Receiver indicated availability in the ${WINDOW_LABEL[preferredWindow]} → schedule redelivery in that window.`);
    if (codIssue) rationale.push("COD cash was not ready; care confirms the amount by phone before dispatch.");
    if (access) rationale.push("Building access was refused; ask the receiver to meet at the gate or inform the guard.");
  } else if (failureReason === "address_issue") {
    recommendedAction = "address_verification";
    rationale.push(`Address quality is ${addressQuality}${landmarks.length ? ` (only landmarks: ${landmarks.join(", ")})` : ""} → collect house/road number before redispatch.`);
  } else if (failureReason === "refused" && codIssue) {
    recommendedAction = "call_customer";
    rationale.push("Refusal is tied to COD cash → care calls to confirm the amount and a time before another attempt.");
  } else if (failureReason === "customer_unreachable") {
    if ((attempts ?? 0) >= 3 && phoneStatus !== "unanswered") {
      recommendedAction = "return_to_sender";
      rationale.push(`${attempts} attempts with the phone ${phoneStatus === "off" ? "switched off" : "wrong"} → initiate return; care sends a final SMS first.`);
    } else {
      recommendedAction = "call_customer";
      rationale.push("Receiver unreachable by the rider → care retries from the desk line and SMS before the next attempt.");
    }
  } else if (failureReason === "access_denied") {
    recommendedAction = "call_customer";
    rationale.push("Entry refused at the building → ask the receiver to collect at the gate or authorise the guard.");
  } else if (failureReason === "customer_unavailable" || failureReason === "reschedule_requested") {
    recommendedAction = preferredWindow ? "evening_redelivery" : "call_customer";
    rationale.push(preferredWindow ? `Receiver asked for ${WINDOW_LABEL[preferredWindow]} → redeliver in that window.` : "Receiver was away with no time given → care confirms a window first.");
  } else if (failureReason === "refused") {
    recommendedAction = "call_customer";
    rationale.push("Refusal without a clear reason → care calls before deciding on return.");
  } else if (rts) {
    recommendedAction = "manual_review";
    rationale.push("Rider suggests return but the note gives no reason → a care agent decides.");
  } else {
    rationale.push("No recognisable failure signal in the note → manual review.");
  }

  // --- confidence ---------------------------------------------------------------------
  let confidence = 0.3;
  const top = ranked[0]?.[1] ?? 0;
  confidence += Math.min(top, 1.2) * 0.35;
  if (attempts !== null && evidence.some((item) => item.label.includes("attempt"))) confidence += 0.08;
  if (preferredWindow) confidence += 0.08;
  if (phoneStatus !== "unknown") confidence += 0.05;
  if (addressQuality !== "unknown") confidence += 0.04;
  if (evidence.length >= 4) confidence += 0.05;
  if (ranked.length >= 2 && ranked[1]![1] >= top * 0.85 && ranked[1]![0] !== failureReason) {
    confidence -= 0.12;
    rationale.push(`Competing signals (${REASON_LABEL[failureReason]} vs ${REASON_LABEL[ranked[1]![0]]}).`);
  }
  if (text.length < 15) confidence -= 0.2;
  if (failureReason === "unknown") confidence = Math.min(confidence, 0.35);
  confidence = Math.max(0.05, Math.min(0.97, Number(confidence.toFixed(2))));

  const needsManualReview = confidence < 0.6 || recommendedAction === "manual_review";
  if (needsManualReview && recommendedAction !== "manual_review") {
    rationale.push(`Confidence ${Math.round(confidence * 100)}% is below the 60% auto-recommend bar → flagged for manual review.`);
  }

  // --- summaries -------------------------------------------------------------------------
  const parts: string[] = [];
  if (attempts !== null) parts.push(`${attempts} delivery attempt${attempts === 1 ? "" : "s"}`);
  parts.push(REASON_LABEL[failureReason]);
  if (phoneStatus === "off") parts.push("phone switched off");
  else if (phoneStatus === "unanswered") parts.push("calls not answered");
  else if (phoneStatus === "wrong_number") parts.push("number appears wrong");
  if (access) parts.push("guard refused entry");
  if (codIssue) parts.push(`COD${context.codAmount ? ` ৳${Math.round(context.codAmount).toLocaleString("en-BD")}` : ""} not ready`);
  if (addressQuality !== "unknown" && addressQuality !== "good") parts.push(`address ${addressQuality}${landmarks.length ? ` (${landmarks.slice(0, 2).join("; ")})` : ""}`);
  if (preferredWindow) parts.push(`receiver available ${WINDOW_LABEL[preferredWindow]}`);
  const summary = capitalize(parts.join("; ")) + ".";

  const senderParts: string[] = [];
  if (failureReason === "refused") senderParts.push("The receiver declined to accept the parcel at the door.");
  else if (failureReason === "damaged") senderParts.push("The parcel was found damaged in transit.");
  else if (failureReason === "address_issue") senderParts.push("The delivery address could not be located on the first attempt.");
  else if (failureReason === "customer_unreachable" || failureReason === "customer_unavailable" || failureReason === "access_denied") senderParts.push("The receiver was not available to accept the parcel.");
  else if (failureReason === "reschedule_requested") senderParts.push("The receiver asked for delivery at another time.");
  else senderParts.push("The first delivery attempt was unsuccessful.");
  if (attempts && attempts > 1) senderParts.push(`${attempts} attempts have been made so far.`);
  senderParts.push(ACTION_SENDER_SAFE[needsManualReview ? "manual_review" : recommendedAction]);

  return {
    attempts,
    failureReason,
    secondaryReasons,
    addressQuality,
    landmarks,
    phoneStatus,
    codIssue,
    refusalFirm,
    preferredWindow,
    availabilityHints,
    summary,
    senderSafeSummary: senderParts.join(" "),
    recommendedAction,
    confidence,
    needsManualReview,
    rationale,
    evidence: dedupeEvidence(evidence),
    source: "heuristic"
  };
}

function dedupeEvidence(items: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  const result: Evidence[] = [];
  for (const item of items.sort((a, b) => b.weight - a.weight)) {
    const key = `${item.label}|${item.quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result.slice(0, 8);
}

function capitalize(value: string): string {
  return value ? value[0]!.toUpperCase() + value.slice(1) : value;
}

/** Human labels for structured fields, shared by the UI and the Gemini prompt. */
export const INCIDENT_LABELS = {
  reason: REASON_LABEL,
  window: WINDOW_LABEL
};
