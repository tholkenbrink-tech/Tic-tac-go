/** Optional haptics via navigator.vibrate; silently degrades when absent. */

let enabled = true

export function setHapticsEnabled(on: boolean): void {
  enabled = on
}

function vibrate(pattern: number | number[]): void {
  if (!enabled) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // unsupported — fine
  }
}

export const haptics = {
  tap: () => vibrate(10),
  move: () => vibrate([12, 30, 12]),
  invalid: () => vibrate([8, 40, 8]),
  win: () => vibrate([30, 60, 30, 60, 80]),
  timeout: () => vibrate([60, 40, 60]),
}
