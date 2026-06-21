# AJM Fit — Cowork Operations System (Design Spec)

- **Date:** 2026-06-21
- **Status:** Approved design — ready for implementation planning
- **Owner:** Shane (build/deploy) → Anthony (daily operator)

## Goal

Let Anthony — non-technical — **run his coaching business by talking to Claude Cowork in plain English**, without relying on Shane day-to-day. He should be able to say things like *"approve James and build him a program from his intake,"* *"message everyone who hasn't logged a workout in a week,"* or *"how's revenue this month?"* and have it done, safely.

## Non-goals

- Anthony's Cowork writing/shipping app code or opening PRs (stays Shane's domain).
- Rebuilding the app. This system *operates* the existing AJM Fit backend.
- Replacing the Luffy trainer portal — Luffy stays; Cowork is an alternate, conversational way to do the same operations.

## Architecture (WAT pattern)

| Layer | Here |
|---|---|
| **Agent** | Anthony's Cowork — the decision-maker he talks to |
| **Workflow** | The runbook Cowork reads — maps plain-English requests → operations + safety rules |
| **Tools** | Operations against the AJM Fit backend, via **MCP connectors where they exist + a small script toolkit for the glue** |
| **Context** | The AJM Fit GitHub repo, connected **read-only** — delivers the toolkit/runbook and grounds Cowork in the data model |
| **Secrets** | Cowork's secret store — AJM Fit's keys, placed once by Shane |

## Components

### 1. Repo access (read-only)
The AJM Fit GitHub repo connected to Anthony's Cowork. Double duty:
- **Delivery** — the toolkit (`tools/ops/`) and runbook live in the repo, so connecting it is how they reach his Cowork.
- **Grounding** — Cowork can read the data model, the intake-form fields (`components/forms/`, `app/api/apply`), and the exercise dataset (`public/exercises/exercises.json`) — required by the AI program builder.
- **Security:** the repo contains **no secrets** (`.env.local` is gitignored), so connecting it leaks nothing. Read-only is sufficient; program content saves to the DB, never the repo.

### 2. Connectors (preferred where they exist)
- **Kit** — newsletter (drafts, broadcasts, publish-to-blog, subscribers/tags). MCP already exists.
- **Supabase** — clients, applications, programs, messages, scheduling, feedback. Anthony connects **his own** Supabase to the AJM Fit project (the org-mismatch that blocks our current MCP doesn't apply in his account).
- **Stripe** — revenue, subscriptions, past-due (MCP if available, else script).

### 3. Script toolkit (`tools/ops/*.mjs`) — the glue
For operations connectors can't do cleanly or that span multiple systems:
- `invite-client` (GoTrue admin invite email)
- `approve-application` (accept → invite → set status, one step)
- `build-program` (the AI program builder — see below)
- multi-system reports (e.g. "clients behind on workouts" = Supabase query + formatting)
Each script is service-role-authed, reads secrets from Cowork's env, and is reviewed/deterministic.

### 4. Runbook (the workflow)
What Cowork reads to translate requests into the right operation, in order, with edge-case handling and the safety rules below.

### 5. Two docs
- **`SETUP.md` (Shane, one-time)** — the deploy-to-Anthony's-Cowork checklist (below).
- **`OPERATIONS.md` (Anthony, daily)** — plain-English "what you can ask for," grouped by the operation surface, with example phrasings and what to expect.

## Operation surface

| Area | Operations |
|---|---|
| **Clients** | list/search; view a client's full profile (application, tier, status, last workout) |
| **Applications** | approve (→ invite + pending), decline |
| **Lifecycle** | send invite; set status (active/paused/cancelled); toggle beta access |
| **Programs** | assign a program; **AI-build a program** from intake + Anthony's notes |
| **Messaging** | read a client thread; send a message; find unread / behind-on-workouts |
| **Scheduling** | create a Zoom session; list upcoming; cancel |
| **Money** | revenue this month; active subs; who's past due (Stripe) |
| **Feedback** | read the in-app feedback inbox |
| **Newsletter** | draft/send a Kit broadcast; publish an issue to the blog (mark public); manage subscribers/tags |

## AI program builder (the deferred feature, now scoped)

- **Input:** the client's intake (goals, equipment, availability, health limitations, tier) + Anthony's notes/preferences.
- **Process:** Cowork drafts a structured program; Anthony reviews/edits conversationally; on approval it saves to the DB and assigns to the client.
- **Output:** the client sees the real program on `/studio/programs` (which is currently the honest self-guided placeholder).
- **Prerequisite (schema gap):** programs in the DB are **metadata-only** today (name/level/split/days). A **structured-program model** (program → days → exercises → sets/reps/rest) must be added to Supabase before the builder can store real content. This is the one net-new build the system depends on.

## Safety model

- **Read freely; confirm writes.** Every write (approve, decline, message, status/beta change, anything Stripe-touching) shows a one-line summary and asks Anthony to confirm before executing — a misread never auto-fires.
- **Append-only action log** so there's a record of what Cowork did.
- **Secrets:** AJM Fit's keys live only in Cowork's secret store. Consider restricting/scoping the highest-risk keys (Stripe) where possible.

## Portability principle (account-level, never machine-local)

Shane sets this up by signing into **Anthony's account** from any computer. This works **only because Cowork state is account-level (cloud), not device-level** — connectors, the project/workspace, files in it, and the secret store persist against Anthony's account, so they're all present when Anthony later signs in on his own laptop.

**Hard rule:** nothing AJM-Fit-specific may live only on Shane's machine. No local folder, no local `.env`, no locally-running MCP server — those do **not** travel to Anthony. Everything lives in: Cowork's project + its secret store + cloud connectors + the **connected GitHub repo** (the reason the toolkit ships *via the repo*, not as local files).

**Connectors must use Anthony's / the business's own logins** (his Kit, Supabase, Google, etc.), so the connections belong to him and don't break if Shane's access is removed.

## Deployment plan (Shane, one-time, in Anthony's Cowork)

0. **Verify Cowork capabilities** — confirm Anthony's Cowork can: run code (the script toolkit), connect a GitHub repo, hold env secrets, and add the needed MCP connectors. *This gates the rest;* if code execution isn't available, fall back to a connectors-only design (and a custom MCP for the glue).
1. **Connect the repo** (read-only) — grant Anthony's Cowork read access to the AJM Fit GitHub repo.
2. **Place secrets** in Cowork's secret store — service-role, Stripe, Kit, Supabase, Zoom, Calendly, SMTP.
3. **Enable connectors** — Kit, Supabase (pointed at the AJM Fit project), Stripe.
4. **Wire the toolkit** — ensure `tools/ops/` scripts run in his environment.
5. **Load the runbook + guardrails.**
6. **Verify** — one read op ("list my clients") and one write-with-confirm ("send a test message"), end to end.
7. **Hand off** — give Anthony `OPERATIONS.md` + a ~10-minute walkthrough.

## Open dependencies / risks

- **Cowork capability uncertainty** — resolved at Step 0; the whole design assumes code-exec + connectors + secret storage.
- **Secrets in a non-technical user's agent** — mitigated by confirm-on-write, the action log, and key scoping.
- **Structured-program schema** — net-new work required before the AI builder is real.
- **GitHub read access** for Anthony's Cowork (grant on the atlasmindsco repo).
