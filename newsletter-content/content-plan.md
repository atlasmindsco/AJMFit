# Brains & Gains — Micro-Drip Content System

## The model
A serialized **micro-course in your inbox**: one small, self-contained idea from the ISSA certification, every **Thursday**. Not essays — drips. Each issue teaches a single concept and gives one thing to do. Read in under 90 seconds.

Tagline angle: *The ISSA cert, one Thursday at a time.*

## Why micro works here
The ISSA source docs hold far more than anyone reads in a sitting — CPT textbook (~400 pages), Corrective Exercise, Dietary Guidelines, micronutrient sheet. Dripping it out one concept per week means:
- **Never run dry** — there's 18+ months of Thursdays in the material.
- **Higher open rates** — short and predictable beats long and sporadic.
- **Compounding authority** — every issue is sourced from the cert, not opinion.

## Cadence
- **Every Thursday, weekly.** One drip per week. Pick a fixed send time (test **Thu 6 a.m.**) and never move it — the consistency is the product.
- Write in **batches of 4–6** so there's always a month of runway scheduled in Beehiiv.

## Micro-issue template (keep it ~150–220 words)
1. **Subject line** — the hook, 4–7 words.
2. **One concept** — named, defined straight from ISSA (accurate, not invented).
3. **What it means for you** — 2–3 plain sentences.
4. **Do this** — one concrete action for the week.
5. **One-line close** — stewardship nod or next-week teaser.

No fluff, no emojis, American spelling. One idea per issue — if it needs two, it's two issues.

## The drip map (each = one Thursday, in sequence)

### Module 1 — The Principles *(the "why" behind everything)* — CPT Ch.9
1. Progressive overload — the master principle *(drafted)*
2. The General Adaptation Syndrome — why progress takes weeks *(drafted)*
3. Specificity — train for the goal you actually have *(drafted)*
4. Reversibility — why consistency beats intensity *(drafted)*
5. Individual differences & diminishing returns *(drafted)*
6. Training volume — sets × reps × load *(drafted)*

### Module 2 — Dialing the Dials *(acute variables)* — CPT Ch.9
7. Intensity — how heavy is heavy enough
8. Rest periods — matching rest to the load (≥90% = 3–5 min; <60% = 45s–2 min)
9. Training density — same work, less time
10. Reps in reserve — leaving the right amount in the tank
11. Tempo & range of motion — overload without adding weight

### Module 3 — Anatomy of a Workout *(elements of fitness)* — CPT Ch.8
12. The real job of a warm-up
13. Core training (it isn't crunches)
14. Balance training
15. Reactive (power) training
16. Resistance training basics
17. The cooldown — why you don't skip it

### Module 4 — Recovery & the Traps — CPT Ch.9
18. Overreaching vs overtraining
19. Detraining — what you lose, how fast
20. Periodization for normal people

### Module 5 — Flexibility & Movement — CPT Ch.10 / Corrective Exercise
21. Flexibility vs mobility
22. Dynamic vs static stretching — when each belongs
23. Self-myofascial release (the foam roller, explained)
24. "Only correct what needs correcting" — movement screening basics

### Module 6 — Fuel — Dietary Guidelines + Micronutrient sheet
25. Protein, simply
26. The supplement stack that actually matters
27. Micronutrients that quietly matter
…continues. New modules added as the back catalogue grows.

## How to run a batch (repeatable)
1. Open `lib/knowledge-base.json` (1,610 chunks from the 4 ISSA PDFs).
2. Pull the exact passage for the next 4–6 topics.
3. Draft each into the micro template → save in `drips/NNN-slug.md`.
4. Paste into Beehiiv, schedule for the next open Thursdays.

## Free-tier reminders
- 2,500-sub cap, unlimited sends.
- No post/automation API — drafting here, scheduling in the Beehiiv dashboard.
- Welcome email (one allowed automation) is set from `welcome-email.md`.
- Referral program already enabled — keep the "forward to one person" line in each drip.
