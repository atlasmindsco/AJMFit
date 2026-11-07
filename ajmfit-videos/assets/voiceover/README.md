# Voiceover

Empty.

Two routes:

- **Record it.** Anthony's own voice beats synthesis for a coaching brand.
  Phone voice memo in a quiet room is enough. Drop the file here.
- **Generate it.** `npx hyperframes tts` runs Kokoro on-device (needs
  `pip install kokoro-onnx soundfile`), or HeyGen's Voice Turbo gives 3 minutes
  a month on the free plan — though that path needs the HeyGen CLI, which does
  not yet run on Windows. See `../music/README.md`.

Captions from a voice track: `npx hyperframes transcribe`, then follow the
`captions.md` reference in the hyperframes skill.
