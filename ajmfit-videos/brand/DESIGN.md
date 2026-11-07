# AJM FIT — video brand reference

Everything an agent or an editor needs to make a video that looks like AJM FIT
and passes `npx hyperframes check` the first time.

The constraints in **Rules the renderer enforces** are not style preferences.
Each one is a check that failed on a real render here, with the measurement
that failed it.

---

## Colour

Taken from `tailwind.config.ts`, so video and product never drift apart.

| Token | Hex | Use |
| --- | --- | --- |
| `--ground` | `#111111` | Every background. The product's `surface.base`. |
| `--raised` | `#1C1C1C` | Cards sitting on the ground. |
| `--ink` | `#FFFFFF` | Headlines and primary text. |
| `--ink-dim` | `rgba(255,255,255,0.68)` | Secondary text. **Never below 0.60** — see contrast. |
| `--orange` | `#F76B16` | The accent. Numbers, rules, the one button. |
| `--orangedark` | `#D8590C` | Pressed state only; rarely in video. |
| `--blue` | `#1A7BFF` | The product's primary action colour. Sparingly. |
| `--navy` | `#1B2D50` | Light-background compositions only. |

**Orange is a highlighter, not a wall.** One orange element per frame — the
number, or the pill, not both competing. The warm radial wash behind
everything is `rgba(247,107,22,0.20)` at centre fading to zero by 70%.

---

## Type

Only these resolve by name — anything else needs an `@font-face` pointing at a
file in the project, or lint fails `font_family_without_font_face`:

> Inter, Montserrat, Outfit, Nunito, Oswald, League Gothic, **Archivo Black**,
> Space Mono, IBM Plex Mono, JetBrains Mono, EB Garamond, Playfair Display,
> Source Code Pro, Noto Sans JP, Roboto, Open Sans, Lato, Poppins

**AJM FIT uses two:**

```css
--font-display: "Archivo Black", sans-serif;  /* headlines, numbers */
--font-body:    "Inter", sans-serif;          /* everything else */
```

**"Archivo" is not "Archivo Black".** Plain Archivo is not bundled and a render
fails on it. This cost a round trip the first time.

**Never set `font-weight` on Archivo Black.** It ships at one weight. Asking
for 800 sends the compiler to Google Fonts for a face that is already as heavy
as it gets.

### Sizes that work at 1080×1920

| Role | Size | Notes |
| --- | --- | --- |
| Hero number | 380px | `font-variant-numeric: tabular-nums` so counting does not jitter |
| Panel number | 230px | |
| Headline | 96–104px | Three short lines beat two long ones — see the canvas rule |
| Section caption | 60px | |
| Body | 36–42px | |
| Eyebrow / label | 30px, `letter-spacing: 0.34em` | Always add `padding-left` equal to the tracking, or it sits off-centre |

---

## Rules the renderer enforces

### 1. Contrast — 3:1 minimum

`contrast_aa_failure` is an **error**, not a warning; it blocks the render.

- White on `--orange` measures **2.97:1**. It fails. Use `--ground` on orange
  instead, which lands near 6:1 and stays on palette. The checker will suggest
  a grey — ignore it, it is off brand.
- `rgba(255,255,255,0.42)` on `--ground` measures **2.97:1**. It fails. 0.66+
  passes and still reads as secondary.

### 2. Nothing outside the canvas

A two-line headline at 118px measured **1357px wide on a 1080px canvas** and
ran off both edges. At vertical, prefer three short lines to two long ones.
Rough budget for Archivo Black: a character is about 0.6 × the font size, so
keep `characters × size × 0.6` under about 1000px.

### 3. Reading time

The audit has a floor per line and fails below it:

- Short line: about **2.0s** minimum.
- An 11-word line needs about **2.85s**.
- **The closing line needs 2.0s** regardless of length.

When a beat is too tight, lengthen the film. Never speed up the motion.

### 4. Frame 0 is the thumbnail

Social players show frame 0 before anyone presses play. An empty first frame
reads as a broken upload. **Have the logo on screen at `t=0`** — animate its
scale, never fade it from `opacity: 0`.

### 5. One timeline row per element

Every timed element (`class="clip"`) must be a **direct child of the root**.
Nesting content inside a timed `<div>` collapses six rows onto one lane and
triggers a layout warning. Screenshots go in as `<img class="clip">` with the
rounding and border on the image itself, not on a wrapper.

### 6. Determinism

No `Date.now()`, no unseeded `Math.random()`, no timers, no `repeat: -1`. A
counting number is a tweened object the timeline owns:

```js
const counter = { value: 25 };
tl.to(counter, {
  value: 35, duration: 2.1, ease: "power2.out",
  onUpdate: () => { el.textContent = String(Math.round(counter.value)); },
}, 3.3);
```

A `setInterval` does not survive frame-by-frame seeking and will render wrong.

---

## Motion

- **Arrive slow, leave clean.** Entrances `power4.out` over 0.55–0.85s; exits
  `power2.in` over ~0.42s.
- **Stagger by about 0.2s** — number, then title, then body.
- A still image held more than ~3s reads as a freeze. Give screenshots a slow
  push: `scale: 1.035` over the length of the beat, `ease: "none"`.
- One `back.out(1.7)` per film, on the final pill. More than that is cartoonish.
- The background wash breathes across the whole film: `scale 0.9 → 1.06`,
  `sine.inOut`.

---

## Format

| | |
| --- | --- |
| Vertical (Reels, TikTok, Shorts) | **1080×1920**, 30fps — the default here |
| Square | 1080×1080 |
| Landscape (YouTube, site) | 1920×1080 |

Render cost on Anthony's machine is about **1.5× realtime**: a 32s film takes
roughly 46s. There is no duration cap.

**Length:** 10–15s for a cold scroll, 30s+ only when there is something to show
(a product tour earns the time; a stat card does not).

---

## Voice

- Short declaratives. "Open it. Today's session is ready."
- **Every number must be true.** 68 programs, 44 meals, 873 exercises are real
  counts from the database. Fitness marketing invites inflation; a client who
  opens the app and counts is the person we are talking to.
- Never put a client's name or lifts in a public video without asking them.

---

## Commands

```bash
npx hyperframes check --json      # the gate. Fix every error.
npx hyperframes snapshot          # PNGs under .hyperframes/artifacts/snapshots/
npx hyperframes render --quality looks -o out.mp4
```

Always verify the output rather than trusting "render complete": `ffprobe` the
duration and decode a few frames.

---

## Open gaps

- **Music.** The free HeyGen catalogue needs their separate CLI, which does not
  run on Windows yet (their docs recommend WSL). Until then: supply a licensed
  track to `assets/music/`, or add audio in the platform at post time.
- **Footage.** `assets/training-footage/` and `assets/coaching-footage/` are
  empty. Real gym footage would lift every one of these templates above
  motion-graphics-over-black.
