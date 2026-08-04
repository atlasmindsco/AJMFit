# Fix: invite / password-reset emails (for Shane)

Two Supabase Auth misconfigs are breaking the "set your password" / reset flow in production. Both are **dashboard settings** (no code required). ~5 min total.

## Problem
- Invite + reset emails are slow and often spam — they go through Supabase's **built-in email** (rate-limited to a few/hour).
- Generated auth links redirect to **`http://localhost:3000`**, not the live site. Confirmed: an `admin.generateLink({type:'recovery'})` came back with `redirect_to=http://localhost:3000`, meaning the project **Site URL is still localhost** and our `redirectTo` (`/auth/callback?next=/members/reset`) isn't in the allowlist, so it falls back to Site URL. Any emailed link therefore breaks in prod.

## Fix 1 — URL configuration (makes links work)
Dashboard → **Authentication → URL Configuration**:
- **Site URL:** `https://ajmfit.com`
- **Redirect URLs (allowlist):** add `https://ajmfit.com/auth/callback` and `https://ajmfit.com/**`

This is what makes the `redirectTo` in `app/api/admin/invite/route.ts` (`/auth/callback?next=/members/reset`) and the `resetPasswordForEmail` call in `app/(site)/members/page.tsx` actually land on the live set-password page.

## Fix 2 — Custom SMTP (makes emails fast)
Dashboard → **Authentication → Emails → SMTP Settings** → enable custom SMTP using the creds already in the secret store / `.env.local`:
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (same ones the booking-confirmation emails use).
Then raise **Authentication → Rate Limits → Email** if it's still on the default low cap.

Result: invite/reset emails send instantly through Anthony's real mail provider instead of the throttled built-in one.

## Optional (nice-to-have, code)
`app/api/admin/invite/route.ts` uses `inviteUserByEmail` (Supabase email). Fix 2 makes that fast. If you'd rather own the template/deliverability fully, generate the link with `admin.generateLink` and send it via the app's existing nodemailer (same path as booking confirmations). Not required once SMTP is configured.

## Note
Anthony's ops assistant already corrected a client email typo (`amartinezrps@gmai.com` → `@gmail.com`) — unrelated to these settings, just why one specific invite never arrived.
