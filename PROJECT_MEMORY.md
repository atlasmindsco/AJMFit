# AJM FIT — Project Memory

## Overview
- **Path**: `C:\Users\shane\OneDrive\Documents\AI Projects\Atlas Minds\Website Builder\AJM FIT`
- **What**: Personal training website for Anthony J. Martin (ISSA Certified)
- **Stack**: Next.js 14, Tailwind, Framer Motion, React Hook Form + Zod
- **Deployed**: https://ajmfit.com (Vercel, scope `shane-richardsons-projects` under smrichardson2507 — NOT atlasmindsco)
- **Vercel link**: `vercel link --yes --scope shane-richardsons-projects --project ajmfit`
- **Git**: atlasmindsco GitHub account

## Credentials & Config
- **Newsletter**: **Kit (formerly ConvertKit)** — migrated off Beehiiv 2026-06-20 (Beehiiv free had no post/automation API). Account "AJMFit", login `anthony@ajmfit.com`. "Brains & Gains" micro-drip course, weekly Thursday.
  - API route: `/api/newsletter` → Kit v4 (create subscriber → add to welcome sequence → tag). Env on Vercel: `KIT_API_KEY` (also in `.env.local`). Verified live: ajmfit.com signup creates active tagged Kit subscriber.
  - **Model = evergreen SEQUENCE** (not broadcasts): sequence "Brains & Gains — Welcome" (id 2800010) = welcome (immediate, pos 0) + **51 weekly Thursday drips** (delay 7d, send_days=thursday, send_hour 11 ET). Every new subscriber starts at issue 1. Tag "Brains & Gains" id 20490383.
  - **Content automation** in `tools/`: `generate_topic_plan.py` (513 ISSA seeds → `newsletter-content/topic-plan.json`), `generate_drips.py` (gpt-4o-mini drafts faithful drips, ~462 seeds remain), `email_template.py`/`markdown_email.py` (branded HTML: BandGnewsletter.png banner + chea-avatar.jpg footer), `kit_schedule_drip.py`, `kit_schedule_batch.py` (queue+interleaver), `kit_build_sequence.py` (REST append to sequence), `build_review.py` (review.html). 51 drips drafted/in sequence.
  - **Deliverability**: sender name "Coach Anthony". DNS at Hostinger (`HOSTINGER_API_KEY` in `.env.local`; `PUT developers.hostinger.com/api/dns/v1/zones/ajmfit.com`, `overwrite:false` to upsert). Kit Verified Sending Domain CNAMEs added + resolving: `ckespa`(SPF), `cka._domainkey`,`cka2._domainkey`(DKIM) → *.sg3.convertkit.com; `_dmarc` = p=none. Apex A MUST stay 76.76.21.21 (Vercel) — never Kit's landing-page IPs.
  - **Deploy note**: ajmfit lives under PERSONAL Vercel `shane-richardsons-projects` (live ajmfit.com), NOT Atlas Minds team — the local `.vercel/project.json` is stale (team org); re-link before deploying. Kit signup deployed via isolated git worktree to keep unrelated uncommitted work out of prod.
  - Old Beehiiv (`BEEHIIV_API_KEY`/`_PUBLICATION_ID` still on Vercel) holds ~5 legacy subs, not migrated to Kit yet.
- **ExerciseDB**: Using free v1 open-source API (`exercisedb-api.vercel.app`) — no key needed
  - GIF CDN: `https://static.exercisedb.dev/media/{exerciseId}.gif`
  - 1,500 exercises with animated 3D GIFs
  - RapidAPI Pro plan ($11.99/mo) can be cancelled — v2 API never returned gifUrl
  - `RAPIDAPI_KEY` still on Vercel but unused now
- **OpenAI**: `OPENAI_API_KEY` in `.env.local` for Chaedyn chatbot
- **ClickUp**: workspace 9017723361, list 901711321605
- **Email (Hostinger)**: anthony@ajmfit.com / `Iamdiamond1988$`
- **Instagram**: https://www.instagram.com/anthony.j.martin?igsh=cm1qZXdsMW4wb212&utm_source=qr
- **Calendly**: account `anthony@ajmfit.com`, booking base `https://calendly.com/anthony-ajmfit`. Single-account integration via Personal Access Token.
  - User URI: `https://api.calendly.com/users/afd845a3-09a0-41a6-ae8e-436ca16b977a`; Org URI: `https://api.calendly.com/organizations/7961c91c-c17c-4184-b149-99c50e3b4975`
  - Env: `CALENDLY_API_TOKEN` (PAT, `.env.local` only — NOT needed in prod runtime), `CALENDLY_WEBHOOK_TOKEN` (shared secret, in `.env.local` + Vercel prod). **PAT was pasted in chat once — ROTATE before go-live.**
  - **This Calendly plan does NOT issue webhook signing keys** (field absent at user AND org scope). So webhook auth = shared secret in callback URL `?token=...` (CALENDLY_WEBHOOK_TOKEN), checked constant-time. Route falls back to HMAC automatically if a signing key ever exists (`CALENDLY_WEBHOOK_SIGNING_KEY`).
  - **LIVE**: deployed to ajmfit.com (personal Vercel scope). Webhook registered (sub `a70d4d6a-...`, user scope, invitee.created+canceled). Auth verified on prod: no/bad token → 401, good token → 200.
  - Booking syncs into `scheduled_sessions` via `/api/calendly/webhook` (matches invitee by email → users row). Reschedule = Calendly fires canceled+created, both handled. Cancel flips status.
  - Real Calendly event types (verified, slugs wired): "Onboarding Call"=`30min` (30m), "Weekly Check-In"=`weekly-accelerator` (45m), "Live Training"=`live-training` (30m). NOTE: Live Training is 30m in Calendly but page advertises 45m — reconcile.
  - Tier → event-type mapping + weekly quotas in `lib/scheduling-tiers.ts`, matched to signup page (components/sections/Pricing.tsx): **3 event types** — Welcome Call (onboarding), Weekly Check-in (30-45min), Live Training Session (45min). Blueprint = NO calls (self-guided); Accelerator = welcome + 1 check-in/wk; Full = welcome + 1 check-in/wk + 2 training/wk. **Slugs are placeholders (welcome-call, weekly-checkin, training-session) — must match real Calendly event type URLs.**
  - Client books in studio at `/studio/schedule` (CalendlyEmbed prefills email so webhook matches).

## Architecture & Patterns
- Route groups: `app/(site)/` for marketing pages, `app/studio/` for client portal, `app/luffy/` for trainer portal
- Brand tokens: `brand-navy`, `brand-orange`, `brand-blue`, `brand-offwhite`, `brand-slate`
- Fonts: `font-display` (Barlow Condensed) for headings, `font-body` (Barlow) for body
- Custom dumbbell cursor in root layout (JS-injected `cursor:none` only on pointer:fine devices)
- Hero video synced to real-time clock (`Date.now() % duration`) so all visitors see same frame
- Exercise library uses ExerciseDB v1 free API proxied through `/api/exercises`
- Chaedyn AI chatbot component at `components/chat/ChaedynChat.tsx` (floating widget in studio layout)
- `.npmrc` has `legacy-peer-deps=true` for Three.js peer dep resolution (Three.js installed but not currently used)
- Beehiiv free plan limitations: No Send API, no post creation via API, no automation creation via API (all Enterprise-only)

## Equipment Options (Application Form)
Gym, Dumbbells, Calisthenics, Resistance Bands, Kettlebells, Landmine, Full Home Gym

## Pages & Routes
- `/` — Home (hero video, pain section, pricing, newsletter, CTA)
- `/work-with-me` — Programs
- `/about` — About
- `/newsletter` — Newsletter signup
- `/apply` — Multi-step application form (3 steps: info, goals+equipment, availability+tier)
- `/members` — Login page (no auth backend yet, redirects to /studio)
- `/studio` — Client dashboard (workout schedule, progress, messages)
- `/studio/exercises` — Exercise library with 1,500 animated 3D GIFs
- `/studio/programs` — Client programs
- `/studio/nutrition` — Nutrition
- `/studio/community` — Community
- `/luffy` — Trainer portal

## Session Log
### Jun 20, 2026 — Newsletter shipped on Kit (Brains & Gains)
- Migrated newsletter Beehiiv → **Kit**; connected Kit MCP. Repointed `/api/newsletter` to Kit, deployed to personal Vercel (isolated worktree), verified live signup → active tagged Kit subscriber.
- Built **content automation pipeline** (tools/): topic miner (513 ISSA seeds), gpt-4o-mini drafter, branded HTML template (banner+mascot), queue/interleaver. Drafted 51 varied drips (~1 yr), reviewed via review.html.
- Switched broadcasts → **evergreen sequence** (welcome + 51 weekly Thursday drips) so new subscribers start at issue 1. Welcome sequence live.
- Deliverability: sender name "Coach Anthony"; added Kit DKIM/SPF CNAMEs to ajmfit.com DNS via Hostinger API (resolving). Pending: user clicks Validate in Kit.
- Sent branded test emails to shanmarric@gmail.com (landed in Gmail Promotions pre-auth; retest post-auth).
- **Pending**: validate domain in Kit; consider DMARC p=quarantine after sending history; prune weak AI drips; import ~5 legacy Beehiiv subs; cancel ExerciseDB RapidAPI Pro.

### Jun 19, 2026 — Newsletter kickoff (Brains & Gains)
- Verified Beehiiv connection end-to-end (API 200, test subscribe created a subscription)
- Wrote welcome email + first issue + content plan, grounded in ISSA source docs (CPT Ch.9 principles), saved to `newsletter-content/`
- **Pivoted to micro-drip model** (per Shane): small single-concept issues, **weekly every Thursday**, dripping the ISSA docs out over ~18 months
- Drafted Module 1 (The Principles), drips 001–006: progressive overload, GAS, specificity, reversibility, individual differences/diminishing returns, training volume — all sourced from CPT Ch.9
- Built full drip map (27+ topics, 6 modules) + repeatable batch process in `content-plan.md`
- **Pending**: Anthony to set up Welcome Email in Beehiiv dashboard, paste + send issue #001, delete test sub

### Mar 2, 2026
- Built initial site, newsletter integration
- **Pending**: Create welcome email automation in Beehiiv dashboard

### Mar 27-28, 2026
- Added contact bar (email + Instagram) to navbar top + footer
- Increased footer font sizes
- Added Kettlebells + Landmine as equipment options
- Added hover-to-expand tier details on application form
- Added weekly/monthly billing toggle on application
- Added 7-day trial text to pricing section
- Created Members login page at `/members` (no sign-up, forgot password flow)
- Moved CustomCursor to root layout (all pages), fixed cursor-none approach
- Built Exercise Library at `/studio/exercises`:
  - Started with ExerciseDB v2 (RapidAPI Pro $11.99/mo) — no GIFs returned (API bug)
  - Tried Wger API — had static images but not animated
  - Found ExerciseDB v1 free API — 1,500 exercises with animated 3D GIFs
  - Interactive muscle map (SVG body with clickable muscle groups)
  - Equipment category filtering, search, alphabetical grouping
  - Detail modal with animated GIF, muscle map, instructions
- Synced hero video to real-time clock
- Chaedyn AI chatbot added to studio layout (done in parallel session)
- Rebuilt client portal: sidebar → top navbar layout matching reference design
- Built all client portal pages: Dashboard (stat cards, workout, progress chart, macros), Programs (weekly split with day tabs + exercise DB with images), Nutrition (meal plan, macro rings, hydration, supplements), Messages (IM with Coach Anthony), Community (forum, leaderboard, events)
- Built all admin pages: Clients (roster with expandable details, tier breakdown, at-risk), Programs (active + templates + full exercise library with image cycling), Schedule (weekly calendar), Messages (client convos + Chaedyn AI toggle), Settings (profile, business, notifications, billing)
- Built Chaedyn AI chatbot: extracted 1,610 chunks from 4 ISSA PDFs → `lib/knowledge-base.json` (2.4MB). Keyword-based RAG with OpenAI gpt-4o-mini streaming. Max 400 tokens. Avatar from newsletter cartoon (`/chaedyn-avatar.png`).
- `.vercelignore` excludes `docs/`, `assets/`, `scripts/` (ISSA PDFs too large for Vercel 100MB limit)
- Swapped hero video to new `hero_video.mp4` from assets
- OpenAI API key added to Vercel production env vars
- Studio nav: Dashboard, Programs, Nutrition, Messages, Community (Exercises tab removed by user)
- Admin programs page enhanced with full exercise DB from `/exercises/exercises.json` with start/end image cycling

### Jun 21, 2026 — Calendly scheduling (onboarding + tier-based weekly calls)
- Got Calendly dev/API access (PAT for anthony@ajmfit.com), verified via /users/me. Account on paid plan (API + webhooks unlocked).
- Built integration: `lib/calendly.ts` (auth, webhook CRUD, HMAC signature verify), `/api/calendly/webhook` (email-match → upsert `scheduled_sessions`), migration `0008_calendly.sql` (applied: `calendly_event_uri`, `calendly_invitee_uri` + unique idx), `scripts/calendly-register-webhook.mjs`.
- Studio booking UI: `/studio/schedule` page + `components/studio/CalendlyEmbed.tsx` + nav tab. Tier gating via `lib/scheduling-tiers.ts` (blueprint onboarding-only; accelerator 1 weekly; full-experience 2 weekly). Weekly quota enforced by counting this-week sessions.
- **Pending (user, in Calendly dashboard)**: create event types + give real slugs to fill `scheduling-tiers.ts`; connect Zoom in Calendly for auto meeting links; enable recurring on weekly event types; run register-webhook script → paste signing key into `.env.local` + Vercel; **rotate the PAT** (was pasted in chat); commit + deploy.

## Pending Work
- **Authentication**: Wire up real auth (Firebase/Supabase/Clerk) for Members login → studio access
- **Payment integration**: Connect Stripe to pricing tiers
- **Cancel ExerciseDB Pro**: $11.99/mo RapidAPI plan is unused — cancel it
- **Beehiiv welcome email**: Set up in Beehiiv dashboard manually
- **Commit all changes**: Large batch of uncommitted work
- **Netlify failover**: Dual-deploy per deployment infra standards
