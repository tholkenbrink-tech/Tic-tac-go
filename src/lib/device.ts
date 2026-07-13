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

/**
 * Default table layout: touch devices (phones, iPads) lie flat between two
 * players, so face-to-face is the default there; on desktop the players sit
 * next to each other in front of the screen.
 */
export function defaultLayout(): LayoutMode {
  return isTouchDevice() ? 'faceToFace' : 'sideBySide'
}

export function resolveLayout(pref: LayoutPref): LayoutMode {
  return pref === 'auto' ? defaultLayout() : pref
}
