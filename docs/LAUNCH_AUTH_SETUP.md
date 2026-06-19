# Auth Foundation — Setup & Go-Live Steps

Code for real Supabase Auth is merged. To make it live, complete these in order.

## 1. Run the database migration (required)
The migration adds `users.auth_id`, the auto-link trigger, helper functions, and
**Row Level Security** on every client-data table.

- File: [`supabase/migrations/0001_auth_foundation.sql`](../supabase/migrations/0001_auth_foundation.sql)
- Project: `xsmxenpynyusmiihtuex`
- **Option A (dashboard):** Supabase → SQL Editor → paste the file → Run.
- **Option B (automated):** provide the DB connection URI (Settings → Database →
  Connection string) and it can be applied via script — and so can future migrations.

> Until this runs, the portals are **not** secured by the database. The middleware
> route-gate works without it, but RLS does not.

## 2. Service-role key on Vercel (required)
`SUPABASE_SERVICE_ROLE_KEY` is in local `.env.local`. Add the same to Vercel
(Project → Settings → Environment Variables → Production) so invite emails and the
apply route work in production. Redeploy after adding.

## 3. Seed the trainer account (required)
Anthony needs an auth account carrying the trainer role:

```
node scripts/seed-trainer.mjs anthony@ajmfit.com "<a-strong-password>"
```

This creates/updates the account with `app_metadata.role = 'trainer'`, which is what
unlocks `/luffy`.

## 4. Configure Supabase Auth email + redirect URLs (required)
In Supabase → Authentication → URL Configuration:
- **Site URL:** `https://ajmfit.com`
- **Redirect URLs:** add `https://ajmfit.com/auth/callback` and
  `http://localhost:3000/auth/callback` (for local testing).
- Confirm the **Invite** and **Reset Password** email templates are enabled
  (Authentication → Email Templates). The default SMTP works for low volume; for
  production deliverability, set up custom SMTP.

## 5. Rotate the service-role key after launch (recommended)
The current key was shared over chat — treat it as exposed. Rotate in Supabase →
Settings → API, then update `.env.local` + Vercel.

---

## How the flow works now
1. Visitor submits `/apply` → server route writes a **pending** user + application
   (service role; browser has no DB write access).
2. Anthony reviews in `/luffy/clients` → **Accept** sets status active **and** emails
   the client a "set your password" invite.
3. Client clicks the invite → `/auth/callback` establishes a session → `/members/reset`
   to set a password → lands in `/studio`.
4. Returning clients log in at `/members`. Anthony logs in there too and is routed to
   `/luffy`.

Route protection is enforced in [`middleware.ts`](../middleware.ts); data access is
enforced by RLS (step 1). Payment (Stripe) is the next sub-project — for now, an
accepted client gets studio access on invite.
