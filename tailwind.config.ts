import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          white: '#FFFFFF',
          offwhite: '#F4F6F9',
          navy: '#1B2D50',
          blue: '#1A7BFF',
          // Pressed/hover states for the brand colours. Previously the button
          // hovered to Tailwind's stock orange-600/blue-700, which are a
          // different hue family than the brand and made the primary CTA drift
          // off-palette on the most-clicked element in the product.
          bluedark: '#0F5FE0',
          /* THE PRIMARY BUTTON'S FILL, which is not the brand blue.
             White on #1A7BFF measures 3.95:1. WCAG AA asks 4.5:1 of
             anything under 18.66px bold, so the same button component was
             compliant or not depending on which size class it had been
             given: Share and Done at 20px passed on the technicality that
             WCAG calls that large text, Start at 16px failed. Nobody can be
             expected to track that, and 3.95:1 is hard to read in a gym
             either way.
             #0F5FE0 takes white to 5.62:1 and #0B4CB8 to 7.66:1, and they
             are the same hue — the button goes one step deeper, not a
             different colour. `blue` is untouched and stays what it always
             was: the brand hue, for tints, borders, accent strokes and the
             progress strip, where the ratio is measured the other way round
             and is fine. A dot or an icon circle also keeps `blue`: a
             graphic owes 3:1, not 4.5:1, and passes. */
          bluefill: '#0F5FE0',
          bluefillhover: '#0B4CB8',
          /* Brand blue as TEXT on a dark surface, which the brand blue itself
             cannot do. #1A7BFF was chosen for buttons, where it is a
             background with white on top, and it is excellent at that. Used
             as text on the studio's #1C1C1C it measures 4.32:1 — under the
             4.5:1 that WCAG AA asks for anything that is not 24px, or 18.66px
             bold. Every "Today" eyebrow, every blue caption and every blue
             link in the client app was below the line, which is part of what
             a client meant by "hard to see some of the words": raising the
             font sizes helped and could not fix it, because the colour was
             short, not the size.
             #4D9AFF is the same hue lifted until it clears: 5.99:1 on #1C1C1C
             and 6.64:1 on #111111. It is for text and icons only — a button
             still uses `blue`, where the ratio is measured the other way
             round. lib/contrast.ts does the arithmetic and
             tools/verify-contrast.ts fails the build if either drifts. */
          blueink: '#4D9AFF',
          orange: '#F76B16',
          orangedark: '#D8590C',
          slate: '#64748B',
          /* Achievement gold. Its own token rather than reusing `warning`,
             which is the colour of "something needs your attention" — a
             personal record is the opposite of that, and a trophy drawn in
             the same amber as a sync warning is the app saying two different
             things in one colour.
             A customer asked for this directly: "I love how the trophy pops
             up when you hit a PR, so it would be cool if the little PR
             section with the trophy — just the label — would be gold too."
             #D4AF37 reads 8.98:1 on #111 and 8.10:1 on #1C1C1C.

             IT LIVES UNDER `brand`, AND THAT IS NOT A DETAIL. It spent a
             release under `state` while all twelve usages in the app said
             `brand-gold`. Tailwind does not warn about a class that names a
             colour it has never heard of — it simply emits no rule, so the
             label and the trophy rendered with no colour of their own and
             inherited whatever was above them: a dim navy, barely visible on
             black. The PR row shipped looking broken and every check passed,
             because nothing checked that a colour class resolves to a real
             token. tools/verify-tokens.ts does now.
             It is also the right home on the merits: gold is not a state. A
             record is not a status the app reports, it is the thing the
             client came for. */
          gold: '#D4AF37',
        },
        // Dark surfaces for the client studio and trainer portal. These were
        // previously hand-written per component as six different near-blacks
        // (#0A0A0A, #111, #111111, #1A1A1A, #1C1C1C, #0F1923) with no scale.
        surface: {
          base: '#111111',
          raised: '#1C1C1C',
          overlay: '#1A1A1A',
        },
        state: {
          success: '#22C55E',
          warning: '#F59E0B',
          danger: '#EF4444',
          // Achievement gold is NOT here. It is `brand.gold` — see the note
          // on it. A personal record is not a state the app is reporting.
        },
        /* THE INTENSITY TECHNIQUES, AND WHY THEY ARE NOT STATE COLOURS.
           Drop sets, rest-pause and partials are three choices of equal
           standing — a categorical scale, where the only job of the colour is
           to tell them apart. They had been written inline as Tailwind's stock
           red-500, purple-500 and amber-500, which put two of the three on
           exactly the values this product uses for danger and warning:
           #EF4444 and #F59E0B to the digit. So a drop-set badge was drawn in
           the same red as a failed save and a partials badge in the same amber
           as a sync warning, which is the mistake the gold note above exists to
           describe — one colour saying two unrelated things.
           They have their own hues now, chosen from the arc the semantic
           palette leaves empty. Red sits at 0°, amber at 38°, gold at 46° and
           green at 142°, so roughly 180° to 340° is free, and these three are
           spread across it: cyan, violet, pink.
           What is given up is that red and amber FELT intense, which suited a
           drop set. That feeling is exactly what made them wrong — it is the
           same feeling the app uses for a failed save. These three are peers,
           not a severity ladder, and the only job of the colour is to tell
           them apart.
           Measuring them also caught that the old purple-500 (#A855F7) was
           4.31:1 on #1C1C1C, under AA for the 13px badge it is set in, which
           nobody had noticed in the years it shipped. All three now clear it
           on both studio surfaces, and tools/verify-contrast.ts asserts both
           that they pass and that none of them equals a state colour. */
        technique: {
          drop: '#22D3EE',
          restpause: '#C084FC',
          partial: '#F472B6',
        },
        // Studio text, four measured tiers. See the note in app/globals.css:
        // the thirteen hand-picked white alphas these replace put 370 of 636
        // text usages below WCAG AA, which is what a client reported as
        // "hard to see some of the words". Backed by CSS variables so a
        // light theme is four redefinitions, not 636 edits.
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
          4: 'var(--ink-4)',
        },
        hairline: {
          DEFAULT: 'var(--hairline)',
          strong: 'var(--hairline-strong)',
        },
      },
      // Three radii, one per role. The codebase had six in active use, which is
      // why marketing (rounded-sm) and the studio (rounded-2xl) read as
      // different products.
      borderRadius: {
        control: '0.5rem',
        card: '0.875rem',
      },
      // Type scale. Tailwind's stock xs/sm (12px/14px) were tuned for
      // desktop density; on a phone — in Barlow Condensed, which is narrower
      // than a normal face at the same nominal size — they read as fine print.
      // Half the studio's text sat at 12px or below. Each step moves up 1px.
      fontSize: {
        // Raised again after a client said some words were too tiny to read.
        // 2xs is used 245 times and xs 394 times, so these two numbers set
        // the floor for most of the text in the product. 11px is below what
        // anyone should have to read on a phone; 12px is the practical
        // minimum and 14px is a comfortable small size. sm stays at 15px,
        // which already reads fine and is used 499 times — raising it too
        // would reflow half the product for a much smaller gain.
        '2xs': ['0.75rem', { lineHeight: '1rem' }],        // 12px, was 11px
        xs: ['0.875rem', { lineHeight: '1.25rem' }],       // 14px, was 13px
        sm: ['0.9375rem', { lineHeight: '1.375rem' }],     // 15px

        /* ── THE ROLE SCALE ──────────────────────────────────────────────
         *
         * The sizes above are named after how big they are, which is why
         * raising them has never fixed the readability complaints. An audit
         * of the client app found 53% of its text at 12px or 14px, with
         * 2xs, xs and sm all living inside a THREE-PIXEL BAND. Three sizes
         * that close cannot express hierarchy: at arm's length in a gym
         * they are the same size, so everything shouts at one volume and
         * nothing is readable at a glance even though each item is
         * technically legible. The problem was never that text was small.
         * It was that nothing was large.
         *
         * So these are named after the JOB, not the measurement, and the
         * gaps between them are deliberate — no two steps within 2px.
         *
         * Why 17 for body and not 16: Barlow is narrow and runs small for
         * its nominal size, so 16px reads like most apps at 15. 17 is a
         * comfortable line without the reflow cost of 18.
         *
         * 13px is the FLOOR. Nothing in the product goes below it, and
         * tools/verify-type-scale.ts fails the build on anything that
         * tries. 21 hardcoded text-[9px] labels existed when this was
         * written, directly contradicting the comment above saying 12px
         * was the minimum — a rule nothing enforced.
         *
         * Migration is deliberately gradual. These coexist with the old
         * names so screens move over one at a time; see the audit's phases
         * 4 and 7. Nothing is removed until nothing uses it.
         */
        metric: ['2rem', { lineHeight: '2.125rem' }],        // 32px — the one number that owns the screen
        title: ['1.5rem', { lineHeight: '1.75rem' }],        // 24px — page title
        heading: ['1.25rem', { lineHeight: '1.625rem' }],    // 20px — section, card, exercise name
        body: ['1.0625rem', { lineHeight: '1.625rem' }],     // 17px — read as a sentence; set rows; inputs
        label: ['0.9375rem', { lineHeight: '1.25rem' }],     // 15px — secondary lines, nav
        caption: ['0.8125rem', { lineHeight: '1.125rem' }],  // 13px — units, timestamps. The floor.
        /* Size and line-height only. A fontSize token that also sets
         * letterSpacing emits it in the same rule as the font-size, so it
         * races `tracking-wide` on the same element and which one wins
         * depends on stylesheet order. Most badges in this app already
         * carry a tracking utility; leave that to them. */
        badge: ['0.8125rem', { lineHeight: '0.875rem' }],    // 13px — status pills
      },
      fontFamily: {
        display: ['var(--font-barlow-condensed)', 'sans-serif'],
        body: ['var(--font-barlow)', 'sans-serif'],
      },

      /* ── SPACING AND TAP TARGETS ───────────────────────────────────────
       *
       * Named by job, same reasoning as the type scale. Card padding across
       * the studio ranges from 12 to 16px, gaps between cards from 8 to 12,
       * and section breaks from 16 to 24 — all of it chosen a component at a
       * time, which is why screens read as crowded even where no single
       * element is wrong. Six steps on a 4px base, and the big one is the
       * section break, because that is the gap doing the work of telling
       * the eye where one thing ends.
       *
       * tap and taplg are hit areas, not icon sizes. An icon can stay 16 or
       * 20px inside a 44px box, and should — the audit counted 30 controls
       * on the workout screen with boxes of 32px or less, which is a
       * two-attempt tap with a sweaty thumb. 44 is the platform minimum;
       * 48 is for anything pressed between heavy sets: Log Set, +30s, Skip,
       * the weight and rep steppers.
       *
       * These extend Tailwind's numeric scale rather than replacing it, so
       * p-4 keeps working while screens migrate.
       */
      spacing: {
        tight: '4px',    // a label to its own value
        snug: '8px',     // rows inside a card
        base: '12px',    // between grouped elements
        stack: '16px',   // between sibling cards
        card: '20px',    // card inner padding
        section: '32px', // between sections
        tap: '44px',     // minimum hit area, anywhere
        taplg: '48px',   // pressed between heavy sets
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        'marquee-reverse': 'marquee-reverse 30s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'marquee-reverse': {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0%)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
