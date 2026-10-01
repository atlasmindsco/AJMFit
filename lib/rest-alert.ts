/**
 * Telling the client their rest is over.
 *
 * The rest timer had no alert of any kind — no sound, no vibration, nothing. It
 * counted down inside a 32px ring in a card, which meant the only way to use it
 * was to hold the phone and watch it. That is the opposite of training, so in
 * practice nobody used it, and the prescribed rest periods in every program —
 * 180s on a 5x5 bench, 45s on calf raises — may as well not have been written.
 *
 * Two channels, because neither works everywhere. Vibration is silent and right
 * for a gym, but iOS Safari does not implement it. Audio works on iOS but only
 * from a WebAudio context created during a user gesture, and it is rude in a
 * quiet room. Firing both and letting the device drop what it cannot do is more
 * reliable than picking one.
 */

let ctx: AudioContext | null = null

/**
 * Open the audio context while the client is tapping something.
 *
 * Browsers refuse to create or resume one outside a gesture, so this is called
 * from the Start Workout handler. Called later, from a timer callback, it is
 * silently ignored and the beep never plays.
 */
export function primeRestAudio(): void {
  if (typeof window === 'undefined') return
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    if (!ctx) ctx = new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    // No audio on this device. The vibration still fires.
  }
}

/** Two short rising tones. Long enough to notice, short enough not to annoy. */
function beep(): void {
  if (!ctx || ctx.state !== 'running') return
  try {
    const now = ctx.currentTime
    for (const [at, freq] of [[0, 660], [0.18, 880]] as Array<[number, number]>) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      // Ramped rather than switched: a square-edged gain change clicks.
      gain.gain.setValueAtTime(0.0001, now + at)
      gain.gain.exponentialRampToValueAtTime(0.25, now + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.14)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + at)
      osc.stop(now + at + 0.16)
    }
  } catch {
    // Ignore: an alert that fails is not worth breaking a workout over.
  }
}

/** Fire everything this device supports. Safe to call from a timer. */
export function alertRestOver(): void {
  beep()
  try {
    navigator.vibrate?.([120, 80, 120])
  } catch {
    // Not supported on iOS Safari.
  }
}
