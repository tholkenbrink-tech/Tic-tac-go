/**
 * Versioned localStorage persistence. Anything that fails validation is
 * discarded so older or corrupted saves can never produce impossible states.
 */

import { stopClock } from './clocks.ts'
import { activeSymbol } from './reducer.ts'
import { ALL_PIECES } from './types.ts'
import type { ClockType, MatchFormat, MatchState, PieceId } from './types.ts'
import type { AiLevel } from './ai.ts'

export const STORAGE_KEYS = {
  match: 'sttt.v6.match',
  prefs: 'sttt.v1.prefs',
} as const

/** Older match-save keys that are discarded on load. */
const LEGACY_MATCH_KEYS = ['sttt.v1.match', 'sttt.v2.match', 'sttt.v3.match', 'sttt.v4.match', 'sttt.v5.match']

export type LayoutPref = 'auto' | 'faceToFace' | 'sideBySide'

export interface Prefs {
  v: 1
  p1Name: string
  p2Name: string
  format: MatchFormat
  clockType: ClockType
  duelMs: number
  turnLimitMs: number | null
  sound: boolean
  haptics: boolean
  tutorialDone: boolean
  layout: LayoutPref
  /** Player 2 kind: human opponent or the computer. */
  p2Kind: 'human' | 'computer'
  aiLevel: AiLevel
}

export const DEFAULT_PREFS: Prefs = {
  v: 1,
  p1Name: '',
  p2Name: '',
  format: 'best3',
  clockType: 'speed',
  duelMs: 120_000,
  turnLimitMs: null,
  sound: true,
  haptics: true,
  tutorialDone: false,
  layout: 'auto',
  p2Kind: 'human',
  aiLevel: 'medium',
}

type Storage_ = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): Storage_ | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const FORMATS: MatchFormat[] = ['best3', 'best5', 'best7', 'unlimited']
const CLOCK_TYPES: ClockType[] = ['untimed', 'speed', 'duel']

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

export function validateMatch(x: unknown): x is MatchState {
  if (!isRecord(x)) return false
  if (x.v !== 6) return false
  if (!isRecord(x.players) || typeof x.players.p1 !== 'string' || typeof x.players.p2 !== 'string')
    return false
  if (!isRecord(x.config) || !isRecord(x.config.clock)) return false
  if (!FORMATS.includes(x.config.format as MatchFormat)) return false
  if (!CLOCK_TYPES.includes(x.config.clock.type as ClockType)) return false
  if (!isRecord(x.scores) || typeof x.scores.p1 !== 'number' || typeof x.scores.p2 !== 'number')
    return false
  if (typeof x.roundNumber !== 'number' || typeof x.turn !== 'number') return false
  if (x.p1Symbol !== 'X' && x.p1Symbol !== 'O') return false
  if (!['ready', 'playing', 'roundComplete', 'matchComplete'].includes(x.status as string))
    return false
  if (!Array.isArray(x.board) || x.board.length !== 9) return false

  // Board sanity: each piece appears at most once, only known piece ids.
  const seen = new Set<PieceId>()
  for (const cell of x.board) {
    if (cell === null) continue
    if (!ALL_PIECES.includes(cell as PieceId) || seen.has(cell as PieceId)) return false
    seen.add(cell as PieceId)
  }
  // Placement count must match turn progression.
  const placed = seen.size
  const turn = x.turn as number
  if (turn < 0) return false
  const expectedPlaced = Math.min(turn, 6)
  if (x.status === 'playing' && x.roundResult == null && placed !== expectedPlaced) return false
  if (!isRecord(x.clock) || !isRecord(x.clock.duelMs)) return false
  if (!Array.isArray(x.history)) return false
  for (const entry of x.history) {
    if (!isRecord(entry) || !Array.isArray(entry.board) || entry.board.length !== 9) return false
    if (typeof entry.turn !== 'number') return false
  }
  if (typeof x.undosUsed !== 'number' || x.undosUsed < 0) return false
  if (x.ai !== null && x.ai !== undefined) {
    if (!isRecord(x.ai) || !['beginner', 'medium', 'pro'].includes(x.ai.level as string))
      return false
  }
  return true
}

/** Persist the active match with clocks settled and stopped as of `now`. */
export function saveMatch(state: MatchState, now: number): void {
  const storage = safeStorage()
  if (!storage) return
  const toSave: MatchState = {
    ...state,
    selected: null,
    clock: stopClock(state.clock, state.config.clock, activeSymbol(state), now),
  }
  try {
    storage.setItem(STORAGE_KEYS.match, JSON.stringify(toSave))
  } catch {
    // Storage full or unavailable: persistence is best-effort.
  }
}

export function clearSavedMatch(): void {
  safeStorage()?.removeItem(STORAGE_KEYS.match)
}

/**
 * Load a saved match. An in-progress round comes back paused with clocks
 * stopped, so no time is lost between sessions.
 */
export function loadMatch(): MatchState | null {
  const storage = safeStorage()
  if (!storage) return null
  try {
    for (const key of LEGACY_MATCH_KEYS) storage.removeItem(key)
    const raw = storage.getItem(STORAGE_KEYS.match)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!validateMatch(parsed)) {
      storage.removeItem(STORAGE_KEYS.match)
      return null
    }
    if (parsed.status === 'matchComplete') {
      storage.removeItem(STORAGE_KEYS.match)
      return null
    }
    return {
      ...parsed,
      selected: null,
      paused: parsed.status === 'playing' ? true : parsed.paused,
      // A pending undo approval does not survive a reload — approvals are
      // in-the-moment consent, so the request is simply cancelled.
      undoRequest: null,
      clock: { ...parsed.clock, runningSince: null },
    }
  } catch {
    return null
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    safeStorage()?.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs))
  } catch {
    // best-effort
  }
}

export function loadPrefs(): Prefs {
  const storage = safeStorage()
  if (!storage) return DEFAULT_PREFS
  try {
    const raw = storage.getItem(STORAGE_KEYS.prefs)
    if (!raw) return DEFAULT_PREFS
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.v !== 1) return DEFAULT_PREFS
    return {
      ...DEFAULT_PREFS,
      ...(parsed as Partial<Prefs>),
      v: 1,
      format: FORMATS.includes(parsed.format as MatchFormat)
        ? (parsed.format as MatchFormat)
        : DEFAULT_PREFS.format,
      clockType: CLOCK_TYPES.includes(parsed.clockType as ClockType)
        ? (parsed.clockType as ClockType)
        : DEFAULT_PREFS.clockType,
      layout: ['auto', 'faceToFace', 'sideBySide'].includes(parsed.layout as string)
        ? (parsed.layout as LayoutPref)
        : DEFAULT_PREFS.layout,
      p2Kind: parsed.p2Kind === 'computer' ? 'computer' : 'human',
      aiLevel: ['beginner', 'medium', 'pro'].includes(parsed.aiLevel as string)
        ? (parsed.aiLevel as AiLevel)
        : DEFAULT_PREFS.aiLevel,
    }
  } catch {
    return DEFAULT_PREFS
  }
}
