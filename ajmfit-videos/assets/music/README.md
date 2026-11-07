# Music

Empty on purpose, and it is the one real gap in this workspace.

HyperFrames can pull from HeyGen's free catalogue of 10,000+ tracks, but that
path needs HeyGen's separate CLI, and their docs say Windows support is "coming
soon" (WSL recommended). Anthony is signed in to HyperFrames; the blocker is
the second tool, not the account.

Until that changes, three options:

1. **Drop a licensed MP3 here** (Epidemic Sound, Artlist, anything owned) and
   reference it from a template as `<audio id="bgm" src="assets/music/x.mp3">`.
   This gives the best result.
2. **Add audio at post time** in Instagram or TikTok. Trending audio usually
   outperforms a custom bed anyway, and this is what most people do.
3. **Local MusicGen** — free and Windows-native, but needs Python plus PyTorch
   (~3GB) and the output tends to be generic.

Mixing, ducking and fades once a track is here: `npx hyperframes` and see the
`media-use` skill reference `mixing.md`.
