# PathaoPoth

Delivery Exception Resolution Desk on **SELISE Blocks**.

A courier moves 40,000 parcels a day through hubs such as Mirpur 10 and Chattogram GEC. About 3-4% become exceptions: delayed, damaged, refused, address missing, disputed. Riders know what happened but type nothing usable. Care improvises. Ownership is "I thought the other team had it." The same lane fails next week and nobody can name it.

PathaoPoth is the desk that makes that stop.

> At any moment, every exception has exactly one owner by name, and the manager can name the route that will fail next week.

## Where to look

| | **Dev (use this for the demo)** | Prod |
| --- | --- | --- |
| App | [https://dblyom-elffd.slsblx.com](https://dblyom-elffd.slsblx.com) | [https://pblyom-elffd.slsblx.com](https://pblyom-elffd.slsblx.com) |
| Git branch | `dev` | `main` |
| Sign-in | Hosted Blocks login. **Demo users for every hat are already provisioned** (hub, rider, care, ops, sender, destination hub). Use the accounts you were given separately. They are not in this repository. | **No users.** Sign-in reaches hosted login and has nobody to authenticate. |
| Data | Ready for the scripted walkthrough. Ops can **Reset & load demo data** on *Team & data* if the desk is empty. | **Empty and intact.** Schemas and roles are in place. There are no parcels, riders, cases, notes, or forecasts. Nothing was seeded. |

**Recommend the dev link for any judged or scripted demo.** Prod is a clean production tenant: brand-new collections, no demo people, no demo rows.

Local HTTPS (same **dev** tenant): `https://dblyom-elffd.slsblx.com:3000`. Never `localhost`. The session cookie only lands on the real project domain over HTTPS.

Log out completely between hats. Do not start on a leftover session.

## Who it is for

| Person | Their world | What the desk gives them |
| --- | --- | --- |
| Hub staff | Minutes per parcel | Open a case in four fields and move on. They stay owner until the next team acknowledges. |
| Rider (Jashim) | Ten stops an hour | Type the note the way they would say it. The desk structures it. |
| Care agent | Angry senders | A recommended next step, one-click confirm, or an honest "manual review". |
| Ops manager | Routes, hubs, vendors | Exception rates by hub, route and rider, and the lane that fails next week. |
| Sender | COD money already paid | What happened, what is being done, when to expect it. Nothing internal. |

## What the desk does

1. **Open a case in seconds.** Parcel, exception type, hub, last touch. Owner, SLA, first sender update and first timeline event are created together.
2. **Turn a rough rider note into a next step.** Attempts, failure reason, address quality, availability hints, recommended action, confidence. Below 0.6 it says manual review instead of bluffing. Riders submit the note; care confirms the step.
3. **Keep exactly one owner.** Transfer does not move ownership. It sets a *pending* team. The current owner stays accountable until the receiving side clicks **Acknowledge & take ownership**. The trail is `from → to` with names and times. There is never a gap.
4. **Show the sender a sanitized stream.** Only `SenderUpdate`. No receiver phone, no street, no Banglish, no internal blame.
5. **Flag SLA.** Refused / delayed / address 24h, damaged 48h, disputed 72h. Views that load the case list raise unflagged breaches.
6. **Name the failing route.** Ops sees week-over-week by lane and type. One click builds a **pre-call list** for tomorrow's COD receivers on that lane.

## Demo walkthrough (about four minutes)

Use the **dev** app. Start as **ops** only if the desk is empty, then log out and follow the hats in order.

**Sample rider note** (paste as-is):

```
3 bar try korsi, phone off chilo, guard dhukte dey na. 2 ta kalo building er pashe basha. Receiver bollo shondhay thakbe, COD 2300 taka ready nai bolse.
```

**Scripted parcel:** tracking id `PP-2609-118292`, COD ৳2,300, receiver in GEC Circle, merchant Dokan24, rider Jashim.

1. **Ops** → *Team & data* → **Reset & load demo data** if you need a fresh city (14 riders, ~250 cases over four rolling weeks, Mirpur 10 → Chattogram GEC refused 8 → 10 → 17 → 24). Then **log out**.
2. **Hub staff (Mirpur 10)** → *Open a case*. Search `2300` or `PP-2609-118292`. Type **Refused delivery**. The case opens with this person as owner. The sender already has a sanitised headline.
3. **Log out.** **Rider (Jashim)** → *My deliveries* → the ৳2,300 stop first → paste the Banglish note. The panel should structure the incident and recommend an evening redelivery window with a confidence. The rider **cannot** confirm the next step.
4. **Log out.** **Care** → open the case. Confirm the recommendation, or override it (for example to **Call the customer**). The sender line follows the confirmed step, not the raw note.
5. **Complication (do not skip).** Still as hub or care, **request transfer** to Care. The hub remains owner; status is awaiting acknowledgement. Care **acknowledges**. Care then transfers to **Chattogram GEC** (pick GEC explicitly; the picker often still shows Mirpur 10). Destination hub staff **acknowledge**. Trail: Mirpur → Care → GEC. No unnamed stretch.
6. **Log out.** **Sender** → only sanitised updates. No phone, no street, no internal notes. Direct `/cases/:id` for an internal case should not leak the staff desk.
7. **Log out.** **Ops** → *Ops overview* / *Route forecast*. Mirpur → CTG GEC refused should read **17 vs 24 (+41%)** on the dominant type, not a milder overall-lane number. **Generate pre-call list.** Care's *Pre-call list* fills.

That is the whole story: one named owner at every second, and a manager who can name next week's failing lane.

## Hats and access

| Role | Sees | Can |
| --- | --- | --- |
| Hub staff | Own hub (origin, destination, or inbound hand-off) | Open, transfer, acknowledge, resolve |
| Rider | Assigned parcels | Submit notes |
| Care agent | Cross-team | Confirm or override next step, acknowledge, work pre-calls |
| Ops manager | Everything | Forecast, pre-call, staff mapping, seed / empty the desk |
| Sender | Own parcels via `SenderUpdate` only | Read |

First login without a mapping gets a default `StaffProfile`. Ops fixes hub / rider / merchant on *Team & data*.

## How it is built

```
Browser  Next.js 16 App Router, React 19, TanStack Query
  │
  ├─ @seliseblocks/client  (one blocksClient)
  │    auth.idp.*     hosted OIDC (public PKCE) → /login/callback
  │    iam.me()       roles → Actor (hub / team / rider / sender)
  │    data.*         nine schemas through the Data Gateway
  │    notifier.*     hand-off, SLA, recommendation
  │    localization.* en-US, bn-BD
  │
  └─ /api/ai/*        note structuring + route narrative (model key stays on the server)
```

**Schemas:** `Parcel`, `ExceptionCase`, `CaseEvent` (ownership trail, `internal` flag), `RiderNote`, `SenderUpdate`, `StaffProfile`, `Rider`, `RoutePrediction`, `PrecallTask`.

Ownership rules live in `src/features/cases/caseService.ts`, not in the buttons. A transfer writes `pendingOwnerTeam`; `acknowledgeTransfer` is what moves `ownerTeam` / `ownerUserId`.

**AI.** `riderNoteEngine.ts` is a deterministic Banglish rule engine. When a server key is present, Gemini is asked for the same JSON shape and cross-checked; disagreement with modest confidence is capped to manual review. If the model is down, the rule engine still answers. `routeRisk.ts` ranks lanes from rolling weekly rates, type concentration, rider concentration and COD exposure. The ops headline uses **dominant-type** week-over-week when that type is concentrated (so refused 17 → 24 is +41%, even if overall exceptions grew less).

**Security.** HTTPS on the project domain. Mutations re-check the actor. Senders use a restricted GraphQL projection; receiver phone and internal events are never requested for that audience.

## Run locally (dev tenant)

```bash
npm install

# once: map the real domain (login will not work on localhost)
echo "127.0.0.1 dblyom-elffd.slsblx.com" | sudo tee -a /etc/hosts
npm run cert
# macOS, once: trust the cert, then restart the browser
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain .cert/dev-cert.pem

npm run dev:https    # https://dblyom-elffd.slsblx.com:3000
```

`blocks.json` on `dev` points at the **D** tenant. `main` points at the **P** tenant. Keep them apart. `.env` is gitignored; it must match the branch you are running.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

Blocks configuration (already done on both environments) went through the `blocks` CLI: public OIDC client, `isOidcEnabled`, five app roles, `blocks data sync` from `blocks/data/`. Mutations used `--dry-run` then `--yes`.

## Limits

- Schema access is Blocks **User** (any signed-in user) plus audience-specific projections. Per-role row policies in the gateway are the next hardening step.
- Analytics run in the browser over desk-sized data. At 40k parcels/day, weekly buckets should be a server job writing `RoutePrediction`.
- Prod has the model and the empty collections. It does not have demo people or demo rows. Do not judge the scripted story there unless you create users and load data yourself.
