# Auth Foundation — Design Spec

**Date:** 2026-06-19
**Sub-project:** 1 of 4 in the AJM FIT launch (Auth → Stripe → App completion → Beta).
**Status:** Approved, in implementation.

## Problem

The app has no real authentication. The "current user" is a UUID kept in `localStorage`
(`lib/current-user.ts`), set when the public application form submits. Consequences:

- The client studio (`/studio/*`) is gated only client-side — trivially bypassable.
- The trainer/admin portal (`/luffy/*`) has **no gate at all** — anyone can view every client.
- `public.users` rows are created by *email upsert* at apply time, with their own random
  UUID, unconnected to any auth identity.

This blocks launch: the portal holds clients' PII and health data, and the planned
apply → approve → pay flow needs trustworthy identity.

## Decisions (locked)

- **Flow:** Apply → Anthony approves in Luffy → client pays (Stripe, Sub-project 2) → access.
- **Auth:** Supabase Auth, cookie sessions via `@supabase/ssr`, enforced in Next.js middleware
  (server-side), with Postgres RLS as the data boundary. ("Approach A".)
- **Client onboarding:** on approval, `supabase.auth.admin.inviteUserByEmail()` sends a
  "set your password" email; setting it activates the account and links it to the existing
  `public.users` row.
- **Trainer:** Anthony only, identified by `app_metadata.role = 'trainer'`.

## Architecture

### Supabase clients (replace single `lib/supabase.ts`)
- `lib/supabase/client.ts` — browser client (`createBrowserClient`) for `'use client'` code.
- `lib/supabase/server.ts` — server client (`createServerClient`) reading/writing the session
  cookie in Server Components / Route Handlers / Server Actions.
- `lib/supabase/middleware.ts` — request-scoped client that refreshes the session.
- `lib/supabase/admin.ts` — service-role client (server-only) for `auth.admin` invites.

`lib/supabase.ts` becomes a thin re-export of the browser client during migration, then is removed.

### Data model (migration)
- `users.auth_id uuid` — nullable, unique, references `auth.users(id)`. Back-filled when a
  client accepts their invite. The public apply flow continues to create a *pending* `users`
  row by email upsert (no auth account yet).
- A DB trigger on `auth.users` insert links the new auth user to the matching `public.users`
  row by email (sets `auth_id`), so accepting an invite wires identity automatically.
- **RLS enabled** on all client-data tables (`users`, `applications`, `meals`, `food_logs`,
  `daily_logs`, `workouts`, `workout_sets`, `exercise_prs`, `exercise_swaps`):
  - Client: `SELECT/INSERT/UPDATE` only own rows (`auth_id = auth.uid()`, child tables via
    `user_id`'s owner).
  - Trainer (`auth.jwt()->'app_metadata'->>'role' = 'trainer'`): full access.
  - `applications` INSERT remains allowed for anon (public form); SELECT restricted to
    owner + trainer.

### Route protection (`middleware.ts`)
| Path | Rule |
|---|---|
| `/studio/*` | authenticated, else redirect `/members?next=…` |
| `/luffy/*` | authenticated **and** `role = 'trainer'`, else redirect |
| everything else | public |

Middleware also refreshes the auth cookie on every matched request.

## Auth flows
- **Client login/logout:** real email + password at `/members` (replaces the `ResumeSession`
  "resume by id" UI). Logout signs out + clears cookie.
- **Password reset:** Supabase reset email → `/members/reset` to set a new password.
- **Invite acceptance:** invite link → set-password page → session established → `/studio`.
- **Trainer login:** Anthony at `/members`; middleware routes trainers to `/luffy`.

## Files

**Add:** `lib/supabase/{client,server,middleware,admin}.ts`, `middleware.ts`, reset-password
page(s), a `acceptApplication` server action (provision invite), migration SQL under
`supabase/migrations/`.

**Modify:** `app/(site)/members/page.tsx` (real login + reset entry), `app/studio/layout.tsx`
and `app/luffy/layout.tsx` (read real session, real sign-out, trainer guard),
`components/forms/IntakeForm.tsx` (drop `setCurrentUserId`), the studio pages/libs using
`getCurrentUserId()` (`app/studio/programs`, `app/studio/nutrition`, +dashboard) to use the
session user id.

**Remove (after migration):** `lib/current-user.ts`, `components/studio/ResumeSession.tsx`.

## Error handling / edge cases
Wrong password; unconfirmed/expired invite; logged-in user hitting `/members` (→ their portal);
client hitting `/luffy` (→ redirect); re-apply before approval (existing email upsert);
session expiry mid-session (middleware refresh, else redirect); RLS denying a stale
localStorage id (removed entirely).

## Testing
No test harness exists; introduce a manual auth matrix run on localhost (logged-out / client /
trainer × `/studio`, `/luffy`, marketing) plus RLS probes (client cannot read another client's
rows; trainer can). Screenshot key states per project CLAUDE.md.

## Prerequisites (user / ops)
1. **Run the DB migration** — the connected Supabase MCP can't reach project
   `xsmxenpynyusmiihtuex`; DDL must run via the Supabase SQL Editor (paste the migration) or a
   direct DB connection string provided to automate it.
2. `SUPABASE_SERVICE_ROLE_KEY` — added to `.env.local`; must also be set on Vercel (production).
3. Seed Anthony's trainer auth user (email TBD, likely `anthony@ajmfit.com`) with
   `app_metadata.role = 'trainer'`.
4. Rotate the service-role key post-launch (it was shared in chat).

## Out of scope (later sub-projects)
Stripe / subscriptions tables, Calendly embed, mock-data audit, beta flag + feedback widget.
