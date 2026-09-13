<!-- blocks-skills:start -->
## SELISE Blocks

These rules govern Blocks work in this repo. Skills are vendored at `.codex/skills/<name>/SKILL.md` (Claude Code discovers the same set via `.claude/skills/`). Read the vendored copy directly; there is no CLI command that serves a skill. Re-vendor with BOOTSTRAP.md.

<!-- Everything between these markers is what BOOTSTRAP.md vendors into consumer repos.
     Keep it free of anything true only of this repo or only of a given checkout. -->

## Routing is your job, not the user's

**Never expect the user to name a skill.** There is no `/skill` invocation, no slash command, no menu. Users describe what they want in plain language — "let users upload a profile picture", "why does login redirect back to the login page", "add German translations" — and **you** map that to the right skill and execute it.

- Do **not** ask "which skill should I use?" or list skills for the user to pick from. Reading the request and choosing is your work.
- Do **not** wait to be told. Once the request matches a row in the routing table, load that skill and proceed.
- If the request genuinely spans several skills, pick the one that owns the *first* concrete step, run it, then move to the next. Sequence them yourself.
- If nothing matches, check the vendored skill directories on disk before concluding no skill applies — the table below can lag the vendored set. The published catalog is [`blocks-cli/blocks-skills/`](https://github.com/SELISEdigitalplatforms/blocks-cli/tree/main/blocks-skills).
- Ask the user only about things the routing table cannot settle: a destructive confirmation, a missing credential, or an ambiguous *goal* — never about which skill to run.

The routing table exists so you can decide unaided. Treat a request that names no skill as the normal case, because it is.

## Workflow

1. Understand the objective.
2. If login/project/app state is unknown, probe (below) and start with **`blocks-bootstrap`**.
3. Match the request against the **Skill routing table** yourself, then load the skill by reading its vendored `SKILL.md` (see **Loading a skill** below).
4. Inspect the existing implementation before changing it.
5. Make the smallest correct change, then verify it.

## Prerequisites

The `blocks` CLI is required for terminal/admin work:

```bash
npm install -g @seliseblocks/cli-os@latest
blocks --version
```

**Do not install it automatically.** If `blocks --version` fails, ask first. The SDK for app code is `npm install @seliseblocks/client@latest`.

Read-only probe when state is unknown:

```bash
blocks --version
blocks auth status --json
blocks doctor --json
```

If `blocks` is missing, stop the probe and ask before installing. Don't claim bootstrap is runnable until the CLI exists.

**Never guess a command or a flag — ask the CLI.** `blocks help <command>` prints one command's exact positionals, flags, scope, and whether it mutates; `blocks help <family>` lists a family; `blocks --help --json` lists every command. Read that before running anything unfamiliar, and prefer it over any command spelling you remember, including one from this file. Set `BLOCKS_STRICT_FLAGS=1` in scripted runs so an unrecognized flag hard-fails instead of being warned and ignored.

## Loading a skill

**Skills are vendored files, not a CLI command.** They live on disk as `.codex/skills/<name>/SKILL.md`, with Claude Code discovering the same set through `.claude/skills/`. Read the vendored copy directly.

There is **no `blocks skill list`/`show`/`add`**, and the package does not bundle the skill tree. Don't reach for those commands, and don't treat their absence as a broken install.

If a skill named in the routing table isn't vendored here, the fix is to re-run the vendoring runbook (`BOOTSTRAP.md` in this repo's source) — not to fetch the file ad hoc or write a replacement from memory. The published catalog is [`blocks-cli/blocks-skills/`](https://github.com/SELISEdigitalplatforms/blocks-cli/tree/main/blocks-skills); read from there only to confirm a name, never as a substitute for vendoring.

## Hard rules

- **Never raw `fetch`/`curl` against `api.seliseblocks.com`.** Use the `blocks` CLI or the `@seliseblocks/client` SDK. Every skill states which surface it uses. Bypassing them with raw HTTP is the failure mode these skills exist to prevent.
- **`--dry-run` before `--yes`** on every mutating CLI command. Get human confirmation before destructive or cloud-mutating operations.
- **Never read the CLI's local storage files** (config/token/secret files on disk) or print anything inside them — client ids, root tenant id, account names, tokens. Interact only through `blocks` commands. To repair broken state use `blocks login`, `blocks auth remove <account>`, `blocks projects list --json`, `blocks use <tenantId>`.
- **`blocks projects create` accepts the Blocks terms on the user's behalf** (`isAcceptBlocksTerms`, `isUseBlocksExclusively`). Never run it without explicit consent to that, and never to "try something" — it provisions real cloud tenancy. Run `--dry-run --json` first, then `--yes` only after approval. It creates exactly one app in the `dev` environment; further environments are portal-only.
- **Never expose secrets or credentials.** The former generic `blocks secrets` commands were removed because their backing API no longer accepts the CLI's authentication mode; do not work around their absence with raw HTTP.
- **Don't attribute work to an AI tool** anywhere in this repo — no assistant names in docs, comments, or commit messages.

## Skill routing table

Surface: **CLI** = terminal/admin, project-scoped · **SDK** = `@seliseblocks/client` in app code · **Both** = each surface covers part of the job.

### Start here

| Skill | Use when | Surface |
|---|---|---|
| `blocks-bootstrap` | New user, or `not_logged_in` / `project_not_selected`. Detects state via `blocks auth status --json` / `doctor --json`, closes install/login/project gaps, resolves the app OIDC client, scaffolds with `blocks new web`, and runs `blocks init` inside the app dir only when the work needs project-local Blocks files. **Run before any other skill when state is unknown.** | CLI |

### Data

| Skill | Use when | Surface |
|---|---|---|
| `blocks-data-gateway-configuration` | Defining, editing, securing, validating, or reloading the **data model** — schema fields, access policies, validation rules. `data config/schema/rules/validation/reload`, or the composed `data sync`. | CLI |
| `blocks-data-gateway-crud` | Reading or writing **actual records** through a Data schema from app code. `data.collection(name)` for per-item CRUD, `data.graphql()` for joins/custom shapes. | SDK |
| `blocks-data-storage` | File and document features: upload/download, directory trees, paginated browse/search, versions, rename/move/copy, trash/restore, sharing, ACLs, inheritance. | Both |
| `blocks-storage-configuration` | Choosing/rotating which **provider** backs the file tree (Azure Blob, S3-compatible, local/SFTP) — hosts, credentials, region/endpoint, strategy. Not file operations. | CLI |

### IAM

| Skill | Use when | Surface |
|---|---|---|
| `blocks-iam-account` | The signed-in user's **own** account: activation, forgot/reset/change password, logout(-all), profile bootstrap (`iam.me`/`updateMe`), signup, login-options discovery. | SDK |
| `blocks-iam-users` | Managing **other** users: invite, edit, activate/deactivate, list/search, grant/revoke roles and org access. | Both |
| `blocks-iam-access-control` | RBAC. Two facets: read-only feature-gating by the current user's roles/permissions (common, safe), and creating/editing role & permission definitions (sensitive, human-confirmed only). | Both |
| `blocks-iam-organizations` | Multi-tenant workspaces: org switcher, switching active org context (SDK-only), public signup policy, and — human-confirmed — creating/editing orgs and signup config. | Both |
| `blocks-iam-mfa` | Self-service MFA for the signed-in user (TOTP enroll/verify, OTP, method switch, disable, backup codes) plus tenant-wide MFA **policy** admin. Not admin-forcing MFA onto another user. | Both |
| `blocks-iam-sso-oidc-configuration` | **Enabling** SSO: register an OIDC client and identity provider. Portal remains a valid alternative, especially for federated providers (Google/Azure/Okta). Not `blocks login` — that's the CLI's own login. | CLI |
| `blocks-iam-sso-oidc-implementation` | Extending or debugging the hosted login flow the scaffold already ships: `redirectToProvider` → `/login/callback` → session, `AuthProvider`, `RequireAuth` guards, token refresh, redirect loops, sessions that don't stick. | SDK |

### Localization

| Skill | Use when | Surface |
|---|---|---|
| `blocks-localization-configuration` | **Authoring** translations: local i18n JSON dictionaries, validate/push/pull, languages and modules, glossary terms, AI translation suggestions. | CLI |
| `blocks-localization-implementation` | **Consuming** translations at runtime: language/module discovery, loading dictionaries, `t()` lookup, a language switcher that reloads and re-renders. | SDK |

### Messaging

| Skill | Use when | Surface |
|---|---|---|
| `blocks-mail` | Transactional email — `mail.send()`/`sendToAny()` from app code, or administering SMTP/inbound config, templates, and mailbox history. | Both |
| `blocks-notifier` | **Sending** real-time/offline notifications and managing a user's own notification inbox (notify, list, unread, mark-read). | Both |
| `blocks-notification` | **Configuring** tenant notification *channels* — a different backing service from `notifier`, and not for sending. No SDK path exists. | CLI |

### Platform operations

| Skill | Use when | Surface |
|---|---|---|
| `blocks-release-deployment` | Triggering and inspecting Release builds/deploys: `release deploy`, `release status`, `builds get/list`. Triggers a configured pipeline only — no artifact upload. | CLI |

### Local development

| Skill | Use when | Surface |
|---|---|---|
| `blocks-frontend-local-https` | Running a scaffolded app over HTTPS on its real project domain — required for hosted login, since plain HTTP and `localhost` never receive the session cookie. Covers `npm run cert`, trusting the cert, the hosts entry, and "SSO cookie not set" / Vite "Blocked request" errors. | Scaffold |

### Routing notes

- **Own account vs. other users vs. role definitions** — `blocks-iam-account` / `blocks-iam-users` / `blocks-iam-access-control`. Pick by whose record changes.
- **Configuration vs. implementation** — most areas split in two: a CLI skill that defines the thing and an SDK skill that consumes it at runtime. "Create a schema" is configuration; "fetch products" is implementation.
- **`notifier` sends, `notification` configures.** Different services.
- **`blocks-data-storage` operates on files; `blocks-storage-configuration` chooses the provider underneath.**
- Dependencies: schema work must be reloaded before CRUD sees it; SSO implementation needs a registered OIDC client and HTTPS on the real domain to test.

<!-- blocks-skills:end -->

---

# Project Goal: PathaoPoth — Delivery Exception Resolution Desk

> This section is the project's north star. It lives **outside** the `blocks-skills` markers so re-vendoring the Blocks rules can never overwrite it. Read it before designing any schema, role, screen, or AI feature for this repo. The Blocks skills tell you *how* to build on the platform; this tells you *what* and *why*.

## Background

A courier business moves 40,000 parcels a day through hubs (Mirpur 10, Moghbazar, Chattogram GEC, …). 3–4% become exceptions: delayed, damaged, refused, address missing, disputed by the sender. Riders and hub staff know what happened but record nothing; customer care improvises answers; the same route fails week after week without anyone noticing a pattern.

### The problem today

- A stuck parcel bounces between hub and rider with no accountable owner — "I thought care was handling it."
- Riders' long, rambling notes (three attempts, phone off, guard won't let me in, two black buildings…) never become an actionable next step.
- Senders get silence or guesses.

### Cost of failure

- Each parcel stuck past 72 hours: ~৳120 refund/credit plus ~25 minutes of care time.
- 1,200 exceptions a day ≈ two full-time care agents of pure firefighting.
- Senders with five bad experiences quietly move 20% of volume to a competitor.

## Who is involved

| Person | Their world | What frustrates them |
|---|---|---|
| Hub staff | Loads of parcels, minutes per case | No fast way to record and move on |
| Rider (e.g., Jashim) | On the road, ten stops an hour | Typing long notes is unrealistic; nothing happens to them anyway |
| Care agent | Faces angry senders | No record, no next step, no owner |
| Ops manager | Routes, hubs, vendor riders | Exceptions feel random; can't separate bad routes from bad luck |
| Sender | Gave the parcel and the money (COD) | "Where is it and who is responsible?" |

## What the product must do

1. Let staff open an exception case on a parcel in seconds: what type, where, who last touched it.
2. Capture rider notes in rough form and turn them into something usable (see AI below).
3. Make ownership explicit and continuous: when a case moves from the Mirpur hub team to care to the destination hub, the receiving side acknowledges, and the trail shows who owned it when — ownership is never "nobody."
4. Give the sender a sanitized view: what happened, what's being done, when to expect resolution.
5. Flag SLA breaches on cases aging past thresholds.
6. Show the ops manager exception rates by hub, route, and rider — e.g., Mirpur→Chattogram refused-deliveries up 41% week-over-week — so a route-level fix (pre-call COD customers) becomes obvious.

## Platform capabilities this case will exercise

A strong solution to this case will naturally need to draw on the full range of platform capabilities available — not just one or two. Concretely:

- Separate sign-in and permissions for hub staff, riders, care agents, and the ops manager, scoped to their own hub, assignment, or cross-team view.
- A fast, minimal-friction way to open an exception case on a parcel, with an explicit and continuous ownership trail as it moves between teams.
- A visible acknowledgement step whenever a case changes hands, so ownership is never ambiguous.
- A sanitized, sender-facing view of an exception's status that hides internal notes and receiver contact details.
- Automatic flags when a case ages past an SLA threshold.
- An ops-manager view of exception rates by hub, route, and rider that surfaces a failing route as a pattern, not a one-off complaint.

## Access rules the business expects

- A sender sees their parcels' timeline — with receiver phone numbers and internal notes masked.
- Hub staff see their hub's cases; care sees cross-team detail; riders see what's assigned to them.
- Internal blame-oriented notes are never sender-visible.

## Where AI should help

Convert a long rider note into a structured incident summary — attempts made, failure reason, address quality, availability hints — plus a recommended next step (evening redelivery window / call customer / return-to-sender / courier claim) with a confidence level. A care agent confirms the next step with one click; when confidence is low the product should say "manual review" rather than bluff.

## AI enhancement challenge

The base case asks the AI to turn one rider's rough note into a structured incident and a recommended next step. Push it further: have the AI look across recent exceptions on a route and proactively predict which route is likely to fail again next week — with the evidence behind the call — so the ops manager can act (a pre-call list, a route change) before the next batch of failures, not after.

## Realistic demo case to script

Hub staff opens a refused-delivery case (COD ৳2,300) in four fields. The rider's raw Banglish note lands; the AI structures it and recommends an evening redelivery window; the care agent confirms. Complication: the case must transfer from the Mirpur hub team to care and then to the destination hub — show the acknowledgement at each hop and the complete ownership trail. Close on the manager's route-level view and the pre-call decision it triggers.

## What "great" looks like

At any moment, every exception has exactly one owner by name — and the manager can name the route that will fail next week.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
