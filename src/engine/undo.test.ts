import { describe, expect, it } from 'vitest'
import { canRequestUndo, createMatch, matchReducer } from './reducer.ts'
import { remaining } from './clocks.ts'
import type { CellIndex, MatchConfig, MatchState } from './types.ts'

const T0 = 1_000_000

function config(overrides: Partial<MatchConfig> = {}): MatchConfig {
  return {
    format: 'best3',
    clock: { type: 'untimed', duelMs: 120_000, turnLimitMs: null },
    sound: false,
    haptics: false,
    ...overrides,
  }
}

function started(overrides: Partial<MatchConfig> = {}, now = T0): MatchState {
  return matchReducer(createMatch({ p1: 'Ada', p2: 'Grace' }, config(overrides)), {
    type: 'START_ROUND',
    now,
  })
}

function place(state: MatchState, cell: CellIndex, now = T0): MatchState {
  return matchReducer(state, { type: 'PLACE', cell, now })
}

function move(state: MatchState, cell: CellIndex, now = T0): MatchState {
  return matchReducer(state, { type: 'MOVE', cell, now })
}

function fullUndo(state: MatchState, now = T0): MatchState {
  let s = matchReducer(state, { type: 'REQUEST_UNDO', now })
  s = matchReducer(s, { type: 'APPROVE_UNDO', player: 'p1', now })
  return matchReducer(s, { type: 'APPROVE_UNDO', player: 'p2', now })
}

describe('undo request lifecycle', () => {
  it('cannot request an undo before any move was made', () => {
    const s = started()
    expect(canRequestUndo(s)).toBe(false)
    expect(matchReducer(s, { type: 'REQUEST_UNDO', now: T0 })).toBe(s)
  })

  it('requires both approvals before the move is reverted', () => {
    let s = place(started(), 4)
    s = matchReducer(s, { type: 'REQUEST_UNDO', now: T0 })
    expect(s.undoRequest).toEqual({ approvals: { p1: false, p2: false } })
    expect(s.board[4]).toBe('X1')

    s = matchReducer(s, { type: 'APPROVE_UNDO', player: 'p1', now: T0 })
    expect(s.undoRequest).toEqual({ approvals: { p1: true, p2: false } })
    expect(s.board[4]).toBe('X1') // still not undone

    s = matchReducer(s, { type: 'APPROVE_UNDO', player: 'p2', now: T0 })
    expect(s.undoRequest).toBeNull()
    expect(s.board[4]).toBeNull()
    expect(s.turn).toBe(0)
    expect(s.undosUsed).toBe(1)
  })

  it('cancelling leaves the move in place and consumes no undo', () => {
    let s = place(started(), 4)
    s = matchReducer(s, { type: 'REQUEST_UNDO', now: T0 })
    s = matchReducer(s, { type: 'APPROVE_UNDO', player: 'p1', now: T0 })
    s = matchReducer(s, { type: 'CANCEL_UNDO', now: T0 })
    expect(s.undoRequest).toBeNull()
    expect(s.board[4]).toBe('X1')
    expect(s.undosUsed).toBe(0)
  })

  it('blocks board actions and pause/resume while approval is pending', () => {
    let s = place(started(), 4)
    s = matchReducer(s, { type: 'REQUEST_UNDO', now: T0 })
    expect(place(s, 0)).toBe(s)
    expect(matchReducer(s, { type: 'PAUSE', now: T0 })).toBe(s)
    expect(matchReducer(s, { type: 'RESUME', now: T0 })).toBe(s)
  })
})

describe('undo semantics', () => {
  it('reverts a movement back to its previous cell', () => {
    let s = started()
    for (const cell of [0, 3, 1, 6, 5, 7] as CellIndex[]) s = place(s, cell)
    s = move(s, 2)
    expect(s.board[2]).toBe('X1')
    s = fullUndo(s)
    expect(s.board[0]).toBe('X1')
    expect(s.board[2]).toBeNull()
    expect(s.turn).toBe(6)
    expect(s.phase).toBe('movement')
  })

  it('undoing the sixth placement returns to the placement phase', () => {
    let s = started()
    for (const cell of [0, 3, 1, 6, 5, 7] as CellIndex[]) s = place(s, cell)
    expect(s.phase).toBe('movement')
    s = fullUndo(s)
    expect(s.phase).toBe('placement')
    expect(s.turn).toBe(5)
    expect(s.board[7]).toBeNull()
    // The same placement can be redone.
    s = place(s, 7)
    expect(s.phase).toBe('movement')
  })

  it('allows at most three undos per round', () => {
    let s = started()
    for (const cell of [0, 3, 1] as CellIndex[]) s = place(s, cell)
    for (let i = 0; i < 3; i++) {
      s = fullUndo(s)
      expect(s.undosUsed).toBe(i + 1)
      // Redo a placement so there is always history to undo.
      s = place(s, ([1, 3, 0] as CellIndex[])[i]!)
    }
    expect(canRequestUndo(s)).toBe(false)
    expect(matchReducer(s, { type: 'REQUEST_UNDO', now: T0 })).toBe(s)
  })

  it('resets the undo budget and history on the next round and on restart', () => {
    let s = place(started(), 4)
    s = fullUndo(s)
    expect(s.undosUsed).toBe(1)
    const restarted = matchReducer(s, { type: 'RESTART_ROUND' })
    expect(restarted.undosUsed).toBe(0)
    expect(restarted.history).toEqual([])

    // Win the round, then advance: budget resets too.
    let w = started()
    for (const cell of [0, 3, 1, 4, 2] as CellIndex[]) w = place(w, cell)
    expect(w.status).toBe('roundComplete')
    const next = matchReducer(w, { type: 'NEXT_ROUND' })
    expect(next.undosUsed).toBe(0)
    expect(next.history).toEqual([])
  })

  it('cannot undo after the round is complete', () => {
    let s = started()
    for (const cell of [0, 3, 1, 4, 2] as CellIndex[]) s = place(s, cell)
    expect(s.status).toBe('roundComplete')
    expect(matchReducer(s, { type: 'REQUEST_UNDO', now: T0 })).toBe(s)
  })
})

describe('undo and clocks', () => {
  const timed: Partial<MatchConfig> = {
    clock: { type: 'duel', duelMs: 60_000, turnLimitMs: 20_000 },
  }

  it('stops every clock while approval is pending and no timeout can fire', () => {
    let s = place(started(timed), 4, T0 + 5_000)
    s = matchReducer(s, { type: 'REQUEST_UNDO', now: T0 + 10_000 })
    expect(s.clock.runningSince).toBeNull()
    // A very long deliberation costs nothing and never times anyone out.
    const later = matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 999_999 })
    expect(later).toBe(s)
    const r = remaining(s.clock, s.config.clock, 'O', T0 + 999_999)
    expect(r.duelMs.O).toBe(55_000) // O thought 5s before the request
  })

  it('resumes the clocks and resets the turn timer after an undo', () => {
    let s = place(started(timed), 4, T0 + 5_000) // X used 5s, O to act
    s = matchReducer(s, { type: 'REQUEST_UNDO', now: T0 + 8_000 }) // O deliberated 3s
    s = matchReducer(s, { type: 'APPROVE_UNDO', player: 'p1', now: T0 + 9_000 })
    s = matchReducer(s, { type: 'APPROVE_UNDO', player: 'p2', now: T0 + 9_000 })
    expect(s.clock.runningSince).toBe(T0 + 9_000)
    const r = remaining(s.clock, s.config.clock, 'X', T0 + 9_000)
    expect(r.turnMs).toBe(20_000) // fresh turn limit for the replayed turn
    expect(r.duelMs.X).toBe(55_000) // X's 5s of thought stays spent
    expect(r.duelMs.O).toBe(57_000) // O's 3s before the request stays spent
  })

  it('resumes the clocks unchanged when the request is cancelled', () => {
    let s = place(started(timed), 4, T0 + 5_000)
    s = matchReducer(s, { type: 'REQUEST_UNDO', now: T0 + 8_000 })
    s = matchReducer(s, { type: 'CANCEL_UNDO', now: T0 + 50_000 })
    expect(s.clock.runningSince).toBe(T0 + 50_000)
    const r = remaining(s.clock, s.config.clock, 'O', T0 + 50_000)
    expect(r.duelMs.O).toBe(57_000)
  })
})
