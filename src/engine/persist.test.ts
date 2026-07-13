import { describe, expect, it } from 'vitest'
import { createMatch, matchReducer } from './reducer.ts'
import {
  DEFAULT_PREFS,
  STORAGE_KEYS,
  clearSavedMatch,
  loadMatch,
  loadPrefs,
  saveMatch,
  savePrefs,
} from './persist.ts'
import type { CellIndex, MatchConfig, MatchState } from './types.ts'

const T0 = 1_000_000

const config: MatchConfig = {
  format: 'best5',
  clock: { type: 'speed', duelMs: 120_000, turnLimitMs: 20_000 },
  sound: true,
  haptics: false,
}

function activeMatch(): MatchState {
  let s = createMatch({ p1: 'Ada', p2: 'Grace' }, config)
  s = matchReducer(s, { type: 'START_ROUND', now: T0 })
  s = matchReducer(s, { type: 'PLACE', cell: 0 as CellIndex, now: T0 + 5_000 })
  s = matchReducer(s, { type: 'PLACE', cell: 3 as CellIndex, now: T0 + 8_000 })
  return s
}

describe('match persistence', () => {
  it('round-trips an active match and restores it paused with clocks stopped', () => {
    const s = activeMatch()
    saveMatch(s, T0 + 10_000)
    const restored = loadMatch()
    expect(restored).not.toBeNull()
    expect(restored!.paused).toBe(true)
    expect(restored!.clock.runningSince).toBeNull()
    expect(restored!.board[0]).toBe('X1')
    expect(restored!.board[3]).toBe('O1')
    expect(restored!.turn).toBe(2)
    expect(restored!.players).toEqual({ p1: 'Ada', p2: 'Grace' })
    // 2s of the current turn elapsed by save time (turn timer reset at T0+8s).
    expect(restored!.clock.turnMs).toBe(18_000)
  })

  it('discards saves with an unknown schema version', () => {
    saveMatch(activeMatch(), T0)
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.match)!)
    raw.v = 999
    localStorage.setItem(STORAGE_KEYS.match, JSON.stringify(raw))
    expect(loadMatch()).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.match)).toBeNull()
  })

  it('discards corrupted or impossible saves', () => {
    localStorage.setItem(STORAGE_KEYS.match, 'not json {{{')
    expect(loadMatch()).toBeNull()

    saveMatch(activeMatch(), T0)
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.match)!)
    raw.board[5] = 'X1' // duplicate piece
    localStorage.setItem(STORAGE_KEYS.match, JSON.stringify(raw))
    expect(loadMatch()).toBeNull()
  })

  it('does not restore a completed match', () => {
    let s = activeMatch()
    s = matchReducer(s, { type: 'END_MATCH' })
    saveMatch(s, T0)
    expect(loadMatch()).toBeNull()
  })

  it('clears the saved match', () => {
    saveMatch(activeMatch(), T0)
    clearSavedMatch()
    expect(loadMatch()).toBeNull()
  })

  it('discards legacy v1 saves', () => {
    localStorage.setItem('sttt.v1.match', JSON.stringify({ v: 1, anything: true }))
    expect(loadMatch()).toBeNull()
    expect(localStorage.getItem('sttt.v1.match')).toBeNull()
  })

  it('cancels a pending undo request on restore', () => {
    let s = activeMatch()
    s = matchReducer(s, { type: 'REQUEST_UNDO', now: T0 + 9_000 })
    expect(s.undoRequest).not.toBeNull()
    saveMatch(s, T0 + 10_000)
    const restored = loadMatch()
    expect(restored!.undoRequest).toBeNull()
    expect(restored!.paused).toBe(true)
    // History survives, so the undo can be re-requested after resuming.
    expect(restored!.history.length).toBe(2)
  })
})

describe('prefs persistence', () => {
  it('round-trips preferences', () => {
    savePrefs({
      ...DEFAULT_PREFS,
      p1Name: 'Ada',
      p2Name: 'Grace',
      clockType: 'duel',
      duelMs: 60_000,
      turnLimitMs: 10_000,
      tutorialDone: true,
    })
    const p = loadPrefs()
    expect(p.p1Name).toBe('Ada')
    expect(p.clockType).toBe('duel')
    expect(p.turnLimitMs).toBe(10_000)
    expect(p.tutorialDone).toBe(true)
  })

  it('falls back to defaults for missing or invalid prefs', () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
    localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify({ v: 0, clockType: 'warp' }))
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
    localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify({ v: 1, clockType: 'warp' }))
    expect(loadPrefs().clockType).toBe(DEFAULT_PREFS.clockType)
  })
})
