# Anthony Full-Agency Handoff — AJM FIT

Goal: Anthony runs AJM FIT end-to-end from his own new computer, with his own login on every account, no dependency on Shane's machine or Shane's logins for day-to-day work. Shane stays on as a **backup owner** wherever a service supports it (not a single point of failure, not required for daily ops).

Status legend: ✅ already his · 🔶 needs action (Shane must do it, requires Shane's own login) · ❓ unconfirmed, needs a fact-check before acting

---

## 0. Do this first — new laptop setup

Two Claude products, two different jobs. Both are in scope — use whichever fits what Anthony's doing:

- **Claude Cowork — for running the business day-to-day.** There's already an **approved, spec'd design** for this: `docs/superpowers/specs/2026-06-21-cowork-ops-system-design.md`. It lets Anthony talk to his own Cowork in plain English — "approve James and build him a program," "who hasn't logged a workout this week," "how's revenue this month" — with no terminal, no git. It was explicitly **paused pending Anthony's own laptop** ("Resume when Anthony's Cowork is being set up on his laptop") — that's this laptop, so this is the resume trigger. **This is the fast/easy path and should be primary for daily operations.**
  - **Not yet built** — the spec's status is "approved design, ready for implementation." The toolkit (`tools/ops/*.mjs`), the master operating file, and the actual connector wiring haven't been done.
  - **Requires a session logged into Anthony's own Cowork account** — the spec's deployment plan (Step 0 onward, see the spec's "Deployment plan" section) has to run from *inside* Anthony's Cowork, not from Claude Code on Shane's machine. Shane needs to either sign into Anthony's account and drive it, or hand Anthony the spec's self-serve path. This can't be done from this session — it's a different login/product entirely.
  - Ask Claude (in that Cowork session, or in a planning session here first if you want an implementation plan drawn up before touching code) to work through the spec's "Deployment plan" steps 0-7.
- **Claude Code CLI — for actually touching code** (bug fixes, new features, deploys). See `docs/ANTHONY_LAPTOP_SETUP.md` for the exact Windows install steps. Useful any time Anthony wants to change the site itself rather than just operate the business.

He needs his **own Claude.ai account** (Pro or Max) for either product — not Shane's session — otherwise this whole handoff doesn't actually remove the dependency on Shane.

---

## 1. GitHub — repo `atlasmindsco/AJMFit` ✅ (resolved — Anthony has his own `Ajmfit88` login)

- `Ajmfit88` has real Write access, and Anthony has confirmed he knows the password himself. Nothing further needed here — sign in as yourself when GitHub prompts you.
- If GitHub's browser-login popup ever doesn't appear on a push: fall back to a personal access token generated from your own account (Settings → Developer settings → Personal access tokens), fine-grained, scoped to just this repo, Contents read/write only — not a broad "classic" token.

## 2. Vercel — project `ajmfit` (deploys ajmfit.com) 🔶 — partially working, one real dependency left

- **Deploys already work for Anthony today** — `.github/workflows/deploy.yml` runs on every push to `main` and deploys straight to Vercel production via the Vercel CLI in CI. Since he already has GitHub Write access (#1), he can ship changes right now with nothing further from Vercel's side.
- **What's still missing**: he has no actual Vercel account access — no dashboard, no logs, no env var management, no domain settings, can't run `vercel --prod` himself for an ad-hoc deploy. The live project sits under Shane's **personal** Vercel account (`shane-richardsons-projects`), which is single-user — there's no way to add Anthony as a member without moving the project into a Team. (The local `.vercel/project.json` in this repo points at the Atlas Minds team org — that link is stale; real prod is on the personal scope. Re-link after any fresh clone.)
- **The real lingering dependency**: the CI deploy authenticates with `VERCEL_TOKEN` in this repo's Actions secrets — which is Shane's **personal-account-scoped** token. If that token is ever rotated or Shane's account changes, deploys silently break for everyone, Anthony included, with no way for him to fix it himself.
- **Action (Shane, on vercel.com)**:
  1. Create a Vercel **Team** dedicated to AJM FIT — check current Vercel team pricing first, multi-member teams are sometimes a paid tier.
  2. Transfer the `ajmfit` project into that team (Project Settings → Transfer).
  3. Invite Anthony as **Owner** or **Admin**; keep Shane as a member too (backup).
  4. Verify `ajmfit.com` still resolves immediately after the transfer.
  5. Generate a new Vercel token scoped to Anthony's own account/the new team, and replace the `VERCEL_TOKEN` repo secret with it — this is what actually removes Shane's personal token from the deploy path.
  6. On Anthony's machine: `vercel link` inside the repo, select the new team + `ajmfit` project.
- **Do this at a quiet time** and have the site open in a browser tab while transferring, so a break is caught immediately.

## 3. Supabase — project `xsmxenpynyusmiihtuex` 🔶 (partially done)

- **Current state**: Anthony was invited to the Supabase org on 2026-07-28 but the invite required email acceptance — unconfirmed whether he ever accepted.
- **Action (Shane, on supabase.com dashboard, logged in as the org owner)**:
  1. Organization → Members → confirm Anthony's row shows **Active**, not **Pending**. Re-invite if it lapsed.
  2. Set his role to **Owner** or **Admin** (not a read-only/restricted role) for full agency.
  3. On his new machine, Anthony logs into supabase.com himself — no shared password needed once he's a real member.
- Note: the Supabase MCP connected in Claude Code sessions here belongs to a *different* Supabase org, so it can't be used to check or manage this project — must be done directly in the dashboard.

## 4. Domain, DNS, and the anthony@ajmfit.com mailbox — Hostinger ❓ highest priority to nail down

- **Unconfirmed**: whose login owns the Hostinger account that holds the `ajmfit.com` domain, its DNS zone, and the `anthony@ajmfit.com` mailbox. This is the account that controls: the domain registration itself, every DNS record (including the Vercel A record and the Kit sending-domain DKIM/SPF records), and Anthony's own business email.
- **Why this is the one that matters most**: if this login is Shane's, Anthony does not actually control his own domain or his own email account — full stop, regardless of what happens with GitHub/Vercel/Supabase.
- **Action (Shane)**:
  1. Check who the Hostinger account login belongs to today.
  2. If it's Shane's: either (a) transfer the Hostinger account to Anthony's own email/login (Hostinger supports account transfer), or (b) if Hostinger supports sub-users/team access on the plan, add Anthony as a full user rather than transferring outright. Either way, Anthony ends up able to log in himself and manage DNS + his mailbox without Shane.
  3. If it's already Anthony's: nothing to do here except make sure he actually knows the login (many small business owners don't).

## 5. Stripe ✅ (already his)

- Already live under **Anthony's own Stripe account** per prior session notes. No transfer needed. If Shane wants read-only visibility as backup, Anthony can invite Shane as a limited team member from Stripe's dashboard — optional, Anthony's call since it's his business's money.

## 6. Kit (newsletter) ✅ (already his)

- Account login is `anthony@ajmfit.com` already. No transfer needed — just make sure he actually has the password (see mailbox note in #4, since Kit's account recovery routes through that same email).

## 7. Calendly ✅ (already his)

- Account is `anthony@ajmfit.com`. No transfer needed.

## 8. Cal.com ❓

- A `CALCOM_API_KEY` exists (migration off Calendly was decided but never finished — nothing in the app is wired to it yet). Confirm whose Cal.com account this key belongs to before handing it over; if it's a half-finished migration, decide with Anthony whether to finish it or drop it now that he'll own the account either way.

## 9. Zoom — "AJM Fit Scheduling" S2S app ❓

- Confirm which Zoom account (whose login) this Marketplace app lives under. For full agency, Anthony needs admin access to that Zoom account so he can view/rotate the app's credentials himself later without Shane.

## 10. OpenAI (Chaedyn chatbot) 🔶 — billing decision

- The `OPENAI_API_KEY` powering the Chaedyn chatbot is on an OpenAI account whose billing likely traces back to Shane. For Anthony to run the business independently (and for Shane to stop covering a recurring bill for someone else's product), Anthony should create his own OpenAI account/API key and the `OPENAI_API_KEY` env var (in Vercel + his local `.env.local`) should be swapped to his.

## 11. ClickUp — NOT a full transfer

- Workspace `9017723361` is Shane's shared workspace used across all of Shane's projects/clients (LIS, EA, Agents, Accounting), not AJM-FIT-specific. AJM FIT is just one list (`901711321605`) inside it.
- **Action**: give Anthony a Member/Guest seat scoped to that one list with edit rights, rather than transferring or exposing the whole workspace.

---

## Known pending credential rotations (pre-existing, flagged before this handoff)

These secrets have comments in `.env.local` marking them as having "transited chat" at some point and needing rotation — that was already true before today, independent of this handoff. Worth doing now while everything else is being touched, but each one requires updating the value in **both** Vercel's env vars and Anthony's local `.env.local` in the same pass so nothing breaks:

- `STRIPE_SECRET_KEY` (live) — rotate via Stripe dashboard → Developers → API keys.
- `CALENDLY_API_TOKEN` — rotate via Calendly → Integrations & apps → API & webhooks.
- `ZOOM_CLIENT_SECRET` — rotate via Zoom Marketplace → app → App Credentials → Regenerate.
- `DATABASE_URL` password — rotate via Supabase → Settings → Database → Reset password (must also update the connection string, password is URL-encoded).

Not done as part of this handoff — flagging only, since rotating without immediately updating both places would take the live site down.

---

## What NOT to do

- Don't transfer the ClickUp workspace (#11) — it's shared infra, not AJM-FIT-only.
- Don't rotate any of the credentials above without updating Vercel env vars in the same sitting.
- Don't move the Vercel project (#2) without having the live site open to verify immediately after.
