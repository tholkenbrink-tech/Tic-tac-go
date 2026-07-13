/**
 * Optional haptics. Inside the Capacitor iOS/Android shell the native Haptics
 * plugin is used (WKWebView has no navigator.vibrate); in browsers we fall
 * back to navigator.vibrate. Everything silently degrades when unsupported.
 */

let enabled = true

export function setHapticsEnabled(on: boolean): void {
  enabled = on
}

interface CapacitorHaptics {
  impact?: (opts: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void>
  notification?: (opts: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }) => Promise<void>
  vibrate?: (opts: { duration: number }) => Promise<void>
}

function nativeHaptics(): CapacitorHaptics | null {
  if (typeof window === 'undefined') return null
  const cap = (
    window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Haptics?: CapacitorHaptics } }
    }
  ).Capacitor
  if (!cap?.isNativePlatform?.()) return null
  return cap.Plugins?.Haptics ?? null
}

function vibrate(pattern: number | number[]): void {
  if (!enabled) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // unsupported — fine
  }
}

function native(fn: (h: CapacitorHaptics) => Promise<void> | undefined): boolean {
  if (!enabled) return true // consumed: stay silent
  const h = nativeHaptics()
  if (!h) return false
  try {
    void fn(h)?.catch(() => {})
  } catch {
    // unsupported — fine
  }
  return true
}

export const haptics = {
  tap: () => {
    if (!native((h) => h.impact?.({ style: 'LIGHT' }))) vibrate(10)
  },
  move: () => {
    if (!native((h) => h.impact?.({ style: 'MEDIUM' }))) vibrate([12, 30, 12])
  },
  invalid: () => {
    if (!native((h) => h.notification?.({ type: 'WARNING' }))) vibrate([8, 40, 8])
  },
  win: () => {
    if (!native((h) => h.notification?.({ type: 'SUCCESS' }))) vibrate([30, 60, 30, 60, 80])
  },
  timeout: () => {
    if (!native((h) => h.notification?.({ type: 'ERROR' }))) vibrate([60, 40, 60])
  },
}
