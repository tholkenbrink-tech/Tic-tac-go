/**
 * Tiny Web Audio synth — no audio assets. Every sound is a couple of
 * oscillator blips. All functions no-op when sound is off or unsupported.
 */

let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(on: boolean): void {
  enabled = on
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    try {
      ctx = new Ctor()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function blip(
  freq: number,
  at: number,
  duration = 0.09,
  type: OscillatorType = 'sine',
  gainPeak = 0.16,
): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + at
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(gainPeak, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

function guarded(fn: () => void): void {
  if (!enabled) return
  try {
    fn()
  } catch {
    // Audio is always optional.
  }
}

/** Call from a user gesture so iOS unlocks the audio context. */
export function primeAudio(): void {
  if (!enabled) return
  audio()
}

export const sfx = {
  place: (symbol: 'X' | 'O') =>
    guarded(() => blip(symbol === 'X' ? 660 : 440, 0, 0.08, 'triangle')),
  select: () => guarded(() => blip(520, 0, 0.05, 'sine', 0.1)),
  move: (symbol: 'X' | 'O') =>
    guarded(() => {
      blip(symbol === 'X' ? 520 : 360, 0, 0.05, 'triangle', 0.12)
      blip(symbol === 'X' ? 760 : 520, 0.05, 0.07, 'triangle', 0.14)
    }),
  invalid: () => guarded(() => blip(160, 0, 0.1, 'square', 0.07)),
  win: () =>
    guarded(() => {
      blip(523, 0, 0.12, 'triangle', 0.18)
      blip(659, 0.09, 0.12, 'triangle', 0.18)
      blip(784, 0.18, 0.16, 'triangle', 0.18)
      blip(1047, 0.28, 0.28, 'triangle', 0.2)
    }),
  matchWin: () =>
    guarded(() => {
      const notes = [523, 659, 784, 1047, 784, 1047, 1319]
      notes.forEach((n, i) => blip(n, i * 0.11, 0.16, 'triangle', 0.18))
    }),
  timeout: () =>
    guarded(() => {
      blip(320, 0, 0.14, 'sawtooth', 0.1)
      blip(240, 0.12, 0.2, 'sawtooth', 0.1)
    }),
  tick: () => guarded(() => blip(880, 0, 0.04, 'sine', 0.08)),
  pause: () => guarded(() => blip(400, 0, 0.08, 'sine', 0.1)),
}
