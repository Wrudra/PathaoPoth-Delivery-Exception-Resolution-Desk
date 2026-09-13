# PathaoPoth — Delivery Exception Resolution Desk

A courier moves 40,000 parcels a day; 3–4% become exceptions — delayed, damaged, refused, address missing, disputed. Today those parcels bounce between hub and rider with no accountable owner, rider notes never become a next step, senders get silence, and the same route fails week after week without anyone noticing.

PathaoPoth is the desk that fixes that, built on **SELISE Blocks** (IAM, Data Gateway, Notifier, Localization) with a Next.js 16 front end.

> **At any moment, every exception has exactly one owner by name — and the manager can name the route that will fail next week.**

---

## What it does

| Need | How the desk answers it |
| --- | --- |
| Open a case in seconds | Hub staff find the parcel and pick the exception type; **where** (hub) and **who last touched it** are pre-filled from the parcel, with an optional internal note. Owner, SLA deadline, sender update and timeline event are created in the same action. |
| Rider notes become actionable | A rider types a rough **Banglish** note ("3 bar try korsi, phone off, guard dhukte dey na…"). The AI structures it into attempts, failure reason, address quality, availability hints and a **recommended next step with a confidence**. Care confirms with one click. Below 0.6 confidence it says **manual review** instead of bluffing. |
| Ownership is never "nobody" | A transfer does **not** move ownership. It records a *pending* team; the current owner stays accountable until the receiving side clicks **Acknowledge & take ownership**. Every hop is a `CaseEvent` with from/to owner — the trail shows who owned it when. |
| Senders get a sanitized view | Senders read only the `SenderUpdate` stream: what happened, what is being done, when to expect resolution. Internal notes, rider names and receiver contact details are never requested by the sender client. |
| SLA breaches are flagged automatically | Per-type thresholds (refused/delayed/address 24 h, damaged 48 h, disputed 72 h). Any desk view that loads the case list raises unflagged breaches: flag + event + owner notification. |
| The manager sees the pattern | Exception rates by hub, route and rider with week-over-week deltas. A **route forecast** ranks lanes likely to fail next week with named evidence and a recommended fix — e.g. *Mirpur 10 → Chattogram GEC refused deliveries +41% WoW, three quarters COD, one rider on a third of them → pre-call COD customers*. One click generates the **pre-call list** for care. |

## Demo script (≈4 minutes)

1. **Ops manager** → *Team & data* → **Reset & load demo data**. Deterministic dataset: 4 rolling weeks, 8 routes, the Mirpur→CTG GEC refused spike engineered in.
2. **Hub staff (Mirpur 10)** → *Open a case* → find the ৳2,300 COD parcel to GEC Circle → type **Refused delivery**. Case `EX-…` opens with the hub staffer as owner; the sender sees "We are looking into a delivery issue".
3. **Rider (Jashim)** → *My deliveries* → **Send note** with the raw Banglish text. The AI panel shows the structured incident, evidence quotes, and **Evening redelivery (0.78 confidence)**.
4. **Care agent** → *Care queue* → confirm the recommended step with one click. The sender update flips to "Action planned · evening window".
5. Hand-off: hub → **Transfer ownership** to Care (case shows *awaiting acknowledgement*; the hub staffer is still the owner) → care **Acknowledge & take ownership** → transfer to **Chattogram GEC hub** → GEC staff acknowledge. The ownership trail lists three owners by name with timestamps; no gap.
6. **Ops manager** → *Route forecast*. Mirpur→CTG GEC is red: refused 8 → 10 → 17 → 24, +41% WoW, evidence listed. **Generate pre-call list for care** → the care team's *Pre-call list* fills with tomorrow's COD receivers on that lane.

## Architecture

```
Browser (Next.js 16 App Router, React 19, TanStack Query)
│
├─ @seliseblocks/client (single blocksClient)
│    ├─ auth.idp.*        hosted OIDC login (PKCE public client) → /login/callback
│    ├─ iam.me()          roles → Actor (role + hub/team/rider/sender scope)
│    ├─ data.collection() 9 schemas via Data Gateway GraphQL
│    ├─ notifier.*        hand-off / SLA / recommendation pings + inbox
│    └─ localization.*    languages + dictionaries (en-US, bn-BD)
│
└─ Next.js route handlers (server only)
     └─ /api/ai/*  Gemini structured output; GEMINI_API_KEY never reaches the browser
```

### Data model (Blocks Data Gateway, `blocks/data/schemas/`)

| Schema | Purpose |
| --- | --- |
| `Parcel` | Booking, receiver, route, rider, COD. |
| `ExceptionCase` | One exception, one accountable owner (`ownerUserId/ownerName/ownerTeam`), pending transfer, SLA, AI recommendation. |
| `CaseEvent` | Immutable timeline and **ownership trail** (`fromOwner → toOwner`), `internal` flag. |
| `RiderNote` | Raw Banglish text + structured incident + confidence + status. |
| `SenderUpdate` | Sanitized sender-facing timeline — the only case data the sender role reads. |
| `StaffProfile` | Maps an IAM user to hub / team / rider / sender company. |
| `Rider` | Rider master with vendor flag. |
| `RoutePrediction` | Persisted forecasts with evidence JSON and the manager's decision. |
| `PrecallTask` | Pre-call work items generated from a forecast. |

Ownership rules live in one place — `src/features/cases/caseService.ts` — not in the UI.

### Roles (Blocks IAM)

| Role | Sees | Can |
| --- | --- | --- |
| `hub-staff` | Own hub's cases and hand-offs addressed to it | Open cases, transfer, acknowledge, resolve |
| `rider` | Assigned parcels | Submit notes |
| `care-agent` | Cross-team detail | Confirm next steps, acknowledge, work pre-calls |
| `ops-manager` | Everything | Forecasts, decisions, staff mapping, seeding |
| `sender` | Sanitized `SenderUpdate` stream for own parcels | Read only |

Hub/team scope comes from `StaffProfile`; a first login without a mapping is provisioned with defaults and the ops manager adjusts it on *Team & data*.

### AI

- **Rider-note structuring** — `src/features/ai/riderNoteEngine.ts` is a deterministic Banglish rule engine (attempt counting incl. Bangla number words, phone/guard/address/COD/availability lexicon, evidence quotes, confidence). When `GEMINI_API_KEY` is set, `gemini.server.ts` asks Gemini (`gemini-3.8-flash`, JSON `responseSchema`) and **cross-checks** it against the rule engine: disagreement with modest confidence is capped and routed to manual review. Without a key, or if the model fails, the rule engine answers — the desk never blocks on the model.
- **Route forecasting** — `src/features/ai/routeRisk.ts`: rolling weekly rates per lane, Holt trend projection one week out, risk score from named evidence (WoW growth, type concentration, rider concentration, COD exposure, repeat areas). Gemini optionally writes the narrative and a pre-call script from that evidence only.

### Security model

- Hosted login over HTTPS on the project domain (public PKCE client; the session cookie is domain-scoped).
- Role-gated navigation and actions; every mutation re-checks the actor in `caseService` (for example, only the pending team — or an ops manager — can acknowledge a hand-off).
- Sender client uses a **restricted GraphQL projection** (`SENDER_PARCEL_FIELDS`) and a gateway-side `senderCompany` filter — receiver phone/address and internal events are never fetched for that audience.
- The Gemini key is server-only (route handlers); the browser calls `/api/ai/*`.

## Running locally

Blocks hosted login only sets its cookie over HTTPS on the project's own domain — `localhost` will load but never sign in.

```bash
npm install
cp .env.example .env            # public identifiers only; add GEMINI_API_KEY to .env.local if you have one

# one-time, needs sudo
echo "127.0.0.1 dblyom-elffd.slsblx.com" | sudo tee -a /etc/hosts
npm run cert                    # writes .cert/ (git-ignored)
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain .cert/dev-cert.pem   # macOS

npm run dev:https               # https://dblyom-elffd.slsblx.com:3000
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

### Blocks project configuration (done via the `blocks` CLI)

| Step | Command |
| --- | --- |
| Public OIDC client + identity provider | `blocks auth oidc-clients save --client-type public --require-pkce --register-as-identity-provider --auto-redirect …` |
| Enable OIDC login | `blocks auth config save --oidc-enabled …` |
| Roles | `blocks iam roles create --name "Hub Staff" --slug hub-staff` (× 5) |
| Schemas + access rules + reload | `blocks data sync` from `blocks/data/` |
| Users | `blocks iam users create --email … --roles <slug>` |

Every mutating command was run `--dry-run` first, then `--yes`.

## Known limits and next steps

- **Row-level, role-based data policies.** Schemas currently use the Blocks *User* access level (any signed-in user) with audience-specific projections on the client. Blocks supports a *Custom* level with rule groups; wiring per-role RLS there is the next hardening step once the rule format is confirmed.
- **Users.** The project ships with roles configured but no accounts; create one per persona with `blocks iam users create` (activation email is configured) and map hubs on *Team & data*.
- **Volumes.** Analytics aggregate client-side over desk-sized data (thousands of rows). At 40k parcels/day, move the weekly buckets to a scheduled server job writing `RoutePrediction`.
