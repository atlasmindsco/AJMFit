# AJM FIT — Project Memory

## Overview
- **Path**: `C:\Users\shane\OneDrive\Documents\AI Projects\Atlas Minds\Website Builder\AJM FIT`
- **What**: Personal training website
- **Stack**: Next.js 14, Tailwind, Framer Motion
- **Deployed**: https://ajmfit.com (Vercel)

## Credentials & Config
- **Newsletter**: Beehiiv free tier (2,500 subs, unlimited sends)
  - Publication ID: `pub_eaa49601-2981-4050-b11d-0a3de5791737` (must have `pub_` prefix!)
  - API route: `/api/newsletter` → Beehiiv V2 subscriptions endpoint
  - Env vars on Vercel: `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID`
- **ClickUp**: workspace 9017723361, list 901711321605
- **Email (Hostinger)**: anthony@ajmfit.com / `Iamdiamond1988$`

## Architecture & Patterns
- Frontend-design skill must be invoked before writing frontend code
- Beehiiv free plan limitations: No Send API, no post creation via API, no automation creation via API (all Enterprise-only). Must use dashboard for email content and automations.

## Session Log
### Mar 2, 2026
- **Pending**: Create welcome email automation in Beehiiv dashboard
