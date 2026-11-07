# Training footage

Empty. Gym clips go here — sets being worked, bar loading, a rep from a decent
angle.

Everything in `templates/` is currently motion graphics on black, which is
clean but anonymous. One clip of real training behind
`motivational-reel` would do more for it than any amount of typography.

What works:
- Vertical or square, shot on a phone is fine.
- 4 to 8 seconds per clip. Longer gets trimmed anyway.
- Steady. Avoid walking shots; put the phone down.

Use them with `<video class="clip" muted>` and give the file a `data-start` and
`data-duration` like any other timed element. Never call `play()` or seek it —
the renderer drives the timeline. Grades and looks go through
`npx hyperframes media-treatment`, not CSS filters.
