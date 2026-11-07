# AJM FIT — video workspace

Videos are written as HTML and rendered to MP4 with
[HyperFrames](https://github.com/heygen-com/hyperframes). Everything is text,
so a video is editable, diffable and re-renderable — swap a few lines and run
one command.

## Make a video

```bash
cd templates/coaching-tip
npx hyperframes check --json                        # the gate — fix every error
npx hyperframes render --quality looks -o out.mp4
```

Or just ask Claude: *"make a coaching tip video about rest periods"*. The
HyperFrames skills are installed, so it knows the format.

**Read [`brand/DESIGN.md`](brand/DESIGN.md) before writing a composition.** It
holds the colours, the two fonts, and six hard rules the renderer enforces —
each one written down because a real render here failed on it.

## Templates

| | Length | What it is |
| --- | --- | --- |
| [`cinematic-promo`](templates/cinematic-promo) | 32s | The app tour. Real screens captured from ajmfit.com, one beat each. |
| [`client-story`](templates/client-story) | 10s | A single PR, the number counting up from the previous best. |
| [`coaching-tip`](templates/coaching-tip) | 20s | One idea, three numbered points, signed off. |
| [`motivational-reel`](templates/motivational-reel) | 12s | Four hard cuts for a cold scroll. |

Each is a working project that passes `check`. Swap the text nodes marked
`EDIT` and re-render; the structure and motion stay correct.

## Layout

```
assets/logo/              the cut-out mark, transparent, ready to drop in
assets/training-footage/  empty — see its README
assets/coaching-footage/  empty — see its README
assets/music/             empty — see its README, this one has a real blocker
assets/voiceover/         empty — see its README
brand/DESIGN.md           colours, type, motion, and the rules that fail a render
templates/                four working compositions
exports/instagram|tiktok|youtube-shorts/
```

All four templates render 1080×1920, which suits Reels, TikTok and Shorts
alike, so `exports/instagram/` currently holds everything. Split them when a
format actually diverges — a 1920×1080 cut for the website, say.

Exports are gitignored: they are large and reproducible from the templates.

## Honest state

**Working:** all four templates render and pass checks. Five finished MP4s are
in `exports/instagram/`.

**Missing:** sound. No music, no voiceover, no footage. The music gap has a
real cause — HeyGen's free catalogue needs their separate CLI, which does not
run on Windows yet. `assets/music/README.md` has the three ways round it.

**The biggest single improvement** is not another template. It is one clip of
real training or real coaching in `assets/`. Four polished text animations on
black still look like four text animations on black.

## Costs

Render is about 1.5× realtime on this machine: a 32s film takes ~46s. There is
no duration cap. FFmpeg and Chrome are the only prerequisites and both are
installed.
