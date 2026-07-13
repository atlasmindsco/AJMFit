# Blueprint Program Picker — build spec (for Shane)

**Goal:** Let **Blueprint-tier** clients self-pick a pre-made program by **Goal + Days/week + Location**, then train/log against it. Blueprint has no coaching, so this replaces the "your program is being built" placeholder for that tier only. Other tiers are unchanged.

Everything below the DB layer already exists and is live in production — this is mostly wiring, not new content.

---

## 1. What already exists (do NOT rebuild)

- **30 seeded programs** in `public.programs` with `source = 'blueprint'`, each tagged:
  - `goal` — `strength` | `muscle` | `lean_out`
  - `location` — `gym` | `home`
  - `split_key` — see table in §4
  - `recommended` — boolean (highlight in UI)
  - `days_per_week`, `name`, `split`, `description`, `level` (`'All Levels'`)
- **Program content** in `program_days` (→ `day_index`, `name`, `focus`, `notes`) and `program_exercises` (→ `order_index`, `exercise_name`, `sets`, `reps`, `rest_seconds`, `tempo`, `superset_group`, `notes`). Exercise names already match `public/exercises/exercises.json` for demo images.
- **The workout UI** on `app/studio/programs/page.tsx` — day cards, exercise detail, set logging, rest timer, PRs, and an **exercise-swap** menu. It currently renders a **hardcoded `weeklyPlan`** constant. Your job is to feed it the assigned DB program for Blueprint users instead.
- **Helpers** in `lib/programs.ts`: `fetchMyProgram(userId)`, `assignProgram(userId, programId)` (already closes the old assignment before opening the new one), `fetchPrograms()`. Tier check: `fetchMyTier(userId)` in `lib/scheduling.ts` (reads `subscriptions.tier`). Swap persistence: `saveSwap` / `removeSwap` / `fetchSwaps` in `lib/workout.ts`.
- Migration **0010** (already applied) added the tag columns + a unique index on `(goal, split_key, location) where source='blueprint'`.

---

## 2. The one gotcha — assignment is trainer-only

RLS `program_assignments_write` allows **only `is_trainer()`** to insert. A Blueprint client cannot self-assign directly. Pick ONE:

- **(Recommended) Server action / route handler** using the service-role key that: (a) confirms the caller's tier is `blueprint`, (b) confirms the chosen `program_id` has `source='blueprint'`, then (c) calls `assignProgram`. Keeps the "clients can't touch assignments" rule intact.
- **Or** add a narrow RLS policy: allow a user to insert an assignment for themselves **only** when the target program is `source='blueprint'`. (More surface area; the server action is cleaner.)

---

## 3. UI flow (Blueprint tier only, on `/studio/programs`)

```
fetchMyTier(userId)
  ├─ not 'blueprint'  → leave current behavior untouched
  └─ 'blueprint'
       fetchMyProgram(userId)
         ├─ none  → show PICKER
         └─ exists → render that program (§5) + a "Change program" button that reopens the PICKER
```

**Picker steps (3 selectors):**
1. **Goal** — Build Strength / Build Muscle / Lean Out
2. **Days per week** — 3 / 4 / 5 / 6
   - When **5** is chosen, show two split options: **Upper/Lower/Push/Pull/Legs** (badge: *Recommended*) and **Bro Split** (*Alternate*). Days 3/4/6 each map to a single split automatically.
3. **Location** — Gym / Home *(dumbbells only)*

On confirm → resolve to one `program_id` (§4) → assign via the §2 server action → render (§5).

---

## 4. Selector → program resolution

Query: `programs` where `source='blueprint'` AND `goal=<goal>` AND `location=<location>` AND `split_key=<key>`.

| Days | split_key | Notes |
|---|---|---|
| 3 | `3day_fullbody` | Full Body A/B/C |
| 4 | `4day_ul` | Upper/Lower/Upper/Lower |
| 5 | `5day_ulppl` | **recommended=true** |
| 5 | `5day_bro` | alternate (recommended=false) |
| 6 | `6day_ppl_arnold` | 6 lifting days + a Day 7 **active-rest** day (no exercises; `notes` holds the "go run / do something fun" text) |

`goal` ∈ `strength | muscle | lean_out` · `location` ∈ `gym | home`. Exactly one row matches each combo (enforced by the unique index).

---

## 5. Rendering the DB program in the existing UI

Add two fetch helpers (mirror `lib/programs.ts` style), then map DB rows into the shape the page already consumes so logging/timers/PRs/swaps keep working:

- `fetchProgramDays(programId)` → `program_days` ordered by `day_index`
- `fetchProgramExercises(dayIds)` → `program_exercises` ordered by `order_index`

**Field mapping** (DB → the page's `weeklyPlan`/`ProgramExercise` shape):

| Page field | From |
|---|---|
| day `name` / `muscles` | `program_days.name` / `program_days.focus` |
| exercise `name` | `program_exercises.exercise_name` |
| `sets` | `program_exercises.sets` |
| `reps` | `program_exercises.reps` (already free text, e.g. `"8-12"`) |
| `rest` | `program_exercises.rest_seconds` → `"90s"` |
| `series` | derive `A, B, C…` from `order_index`; if `superset_group` is set, share the letter + a numeric suffix (`D1`, `D2`) so the existing `groupBySeries` renders them as a superset |
| rest days | a `program_days` row with **no exercises** (the 6-day Day 7) → render as the existing rest-day card, show its `notes` |

Lean-out days carry a conditioning note in `program_days.notes` — surface it under the day.

---

## 6. Exercise swap ("pick a different one if unavailable")

The swap UI + DB persistence (`exercise_swaps` via `saveSwap`) already exist — just make sure the rendered Blueprint program uses it (it's keyed by exercise name, so it works as-is). **Enhancement (optional):** today the swap menu offers a small hardcoded `exerciseAlternatives` list. Consider letting the client swap to any same-muscle exercise from `exercises.json` (filter by `primaryMuscles`, and by `equipment ∈ {dumbbell, body only}` when the client picked **Home**). Not required for v1.

---

## 7. Acceptance criteria

- A Blueprint client with no program sees the 3-step picker; a non-Blueprint client sees no change.
- Picking Goal + Days + Location (+ Bro/UL-PPL when 5) assigns exactly one program and renders its days/exercises with demo images.
- "Change program" swaps cleanly (old assignment ends, new begins — `assignProgram` handles this).
- Set logging, rest timer, PRs, and exercise swap all work on the assigned program.
- The 6-day option shows 6 training days + a Day 7 active-rest card.

## 8. Out of scope
- No new program content (all 30 are seeded). Content edits are done by re-running `tools/ops/seed-blueprint-programs.mjs` (Anthony/ops side).
- No changes to Accelerator / Full Experience scheduling or programs.

**Source of truth for content:** `program-library/blueprint-library.json` (+ `blueprint-library.md` readable version).
