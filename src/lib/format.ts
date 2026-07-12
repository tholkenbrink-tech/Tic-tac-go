/** Clock formatting: m:ss normally, s.t (tenths) below ten seconds. */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms)
  if (clamped < 10_000) {
    return (Math.ceil(clamped / 100) / 10).toFixed(1)
  }
  const totalSeconds = Math.ceil(clamped / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function isUrgent(ms: number): boolean {
  return ms < 5_000
}
