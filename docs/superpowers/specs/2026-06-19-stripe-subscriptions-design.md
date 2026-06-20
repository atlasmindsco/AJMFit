# Stripe Subscriptions — Design Spec

**Date:** 2026-06-19
**Sub-project:** 2 of 4 (Auth → **Stripe** → App completion → Beta).
**Status:** Built; pending migration 0002 + live test.

## Goal
Turn an approved application into a paying membership. Money lands in Anthony's
Stripe account; the client's studio unlocks on payment/trial start.

## Decisions
- **Stripe Checkout** (hosted), subscription mode, **7-day free trial** on every plan.
- Catalogue: 3 tiers × {monthly, weekly} = 6 prices, addressed by `lookup_key`
  (`<tier>_<cycle>`), created idempotently by `scripts/setup-stripe.mjs`.
  - blueprint $297/mo · $75/wk · accelerator $497/mo · $125/wk · full-experience $697/mo · $175/wk.
- Payment happens **inside the authenticated studio** (not an emailed link): an
  approved client logs in via their invite, sees a "Start your membership" banner,
  and pays. Cleaner + tied to the logged-in user than expiring email links.

## Flow
1. Trainer accepts application in Luffy → invite email (Sub-project 1). User stays
   `pending` (changed: accept no longer sets `active`).
2. Client sets password → lands in `/studio` → `MembershipBanner` shows (status ≠ active).
3. Banner → `POST /api/stripe/checkout`: resolves the price from the client's
   application tier+cycle, ensures a Stripe customer, creates a Checkout Session
   (trial 7 days), returns `url`; browser redirects to Stripe.
4. On completion, Stripe → `POST /api/stripe/webhook` (signature-verified) →
   upserts `subscriptions` and flips `users.status` to `active`. Banner disappears.

## Data (migration 0002)
- `users.stripe_customer_id text`.
- `subscriptions` table: user_id, stripe_customer_id, stripe_subscription_id (unique),
  tier, billing_cycle, status, current_period_end, trial_end, cancel_at_period_end.
- RLS: client reads own / trainer reads all; **all writes via service-role** (webhook).

## Status mapping (webhook)
`trialing|active → active` · `past_due|unpaid → paused` · `canceled → cancelled`.

## Files
- Add: `lib/stripe/{server,catalog}.ts`, `app/api/stripe/{checkout,webhook}/route.ts`,
  `components/studio/MembershipBanner.tsx`, `scripts/setup-stripe.mjs`,
  `supabase/migrations/0002_stripe_subscriptions.sql`.
- Modify: `app/studio/layout.tsx` (banner), `lib/admin.ts` (accept keeps pending),
  `types/supabase.ts`.

## Env (test mode)
`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
— in `.env.local` and on Vercel (production). Webhook endpoint
`https://ajmfit.com/api/stripe/webhook` created via API.

## Pending / open
- Apply migration 0002 (DDL — needs DB access).
- Going live: finish Stripe account onboarding (business + bank) and recreate
  keys/webhook in live mode.
- Future: hard-gate studio features for non-active users (currently banner only);
  cancel/billing-portal link; dunning emails.
