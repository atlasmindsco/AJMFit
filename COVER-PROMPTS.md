# Program cover art — image generation prompts

Style reference: the AJM Fit newsletter banner. To keep 13 covers looking like
one set rather than 13 separate pictures, the style block below is identical in
every prompt and only the bracketed subject changes.

Generate at **1200 x 630**. Save as `public/covers/<split_key>.png`, replacing
the `.svg` of the same name.

## The style block (paste into every prompt, unchanged)

> Bold cartoon vector illustration, thick clean outlines, flat cel shading with
> soft highlights. Split background: vivid orange (#F76B16) on the left third,
> deep blue (#1A7BFF to #0f1d38) on the right, divided by a sharp white diagonal
> streak with a comic speed-line burst. Energetic, friendly, gym-poster energy.
> No text anywhere in the image. No logos. Leave the left third uncluttered for
> a headline to be placed over it. 1200x630, landscape.

## Per-split subject

| split_key | Subject to append to the style block |
|---|---|
| `2day_fullbody` | A cheerful muscular man mid dumbbell squat, one dumbbell in each hand, feet planted wide |
| `3day_fullbody` | A cheerful muscular man holding a dumbbell in each hand at his sides, grinning, relaxed confident stance |
| `4day_ul` | A muscular man split-posed: pressing a barbell overhead while standing in a lunge, upper and lower body both working |
| `4day_torso_limbs` | A muscular man doing a bent-over barbell row, back flexed, arms pulling |
| `5day_ulppl` | A muscular man in a gym surrounded by a barbell, a dumbbell and a pull-up bar, arms crossed, confident |
| `5day_bro` | A muscular man flexing a single huge bicep, classic bodybuilder pose, grinning |
| `6day_ppl` | A muscular man mid push-up with a barbell and dumbbells arranged behind him |
| `6day_ppl_arnold` | A classic golden-era bodybuilder in a double-bicep pose, retro gym vibe |
| `hybrid_strength_run` | A muscular man running hard, a barbell resting in the background behind him |
| `hybrid_hyper_cond` | A muscular man swinging a kettlebell, sweat flying, battle ropes behind |
| `hybrid_athletic` | An athletic man mid box-jump, explosive, knees up |
| `hybrid_strength_endurance` | A muscular man rowing on an erg machine, barbell plates stacked behind |
| `hybrid_complete` | A muscular man standing between a barbell and a running track, arms folded, ready for either |

## Notes

- **No text in the image.** The split name and day count are drawn over the
  cover by the app, so they stay correct when a split is renamed and they read
  properly on a phone. Text baked into an image cannot do either.
- Keep the left third calm. That is where the headline sits.
- The vector covers in `public/covers/*.svg` are the fallback. Any split without
  a PNG keeps using its SVG, so these can be replaced one at a time rather than
  all at once.
