import type { LayoutPref } from '../engine/persist.ts'

export type LayoutMode = 'faceToFace' | 'sideBySide'

/** iPadOS ≥13 reports "Macintosh" but exposes multi-touch. */
export function isIPad(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1)
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  if ((navigator.maxTouchPoints ?? 0) > 0) return true
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

/** Tablets: iPads, or any touch screen with a short side of at least 600px. */
export function isTablet(): boolean {
  if (!isTouchDevice()) return false
  if (isIPad()) return true
  if (typeof screen === 'undefined') return false
  return Math.min(screen.width, screen.height) >= 600
}

export function isLandscape(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(orientation: landscape)').matches ?? false
}

/**
 * Default table layout:
 * - desktop: side-by-side (players share the screen)
 * - tablets: face-to-face (device lies flat between the players)
 * - phones: face-to-face upright, side-by-side when rotated to landscape
 *   (a landscape phone is too shallow for opposite-facing panels)
 */
export function defaultLayout(): LayoutMode {
  if (!isTouchDevice()) return 'sideBySide'
  if (isTablet()) return 'faceToFace'
  return isLandscape() ? 'sideBySide' : 'faceToFace'
}

export function resolveLayout(pref: LayoutPref): LayoutMode {
  return pref === 'auto' ? defaultLayout() : pref
}
