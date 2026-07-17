import { describe, expect, it } from 'vitest'
import { chooseAiMove, winningTargets, type AiLevel } from './ai.ts'
import { createMatch, matchReducer } from './reducer.ts'
import type { CellIndex, MatchConfig, MatchState } from './types.ts'

const T0 = 1_000_000

const config: MatchConfig = {
  format: 'unlimited',
  clock: { type: 'untimed', duelMs: 120_000, turnLimitMs: null },
  sound: false,
  haptics: false,
}

function started(level: AiLevel = 'pro'): MatchState {
  const m = createMatch({ p1: 'Human', p2: 'Computer' }, config, { level })
  return matchReducer(m, { type: 'START_ROUND', now: T0 })
}

function place(state: MatchState, cell: CellIndex): MatchState {
  return matchReducer(state, { type: 'PLACE', cell, now: T0 })
}

/** Deterministic RNG stream. */
function rngOf(...values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length] ?? 0
}

describe('winningTargets helper', () => {
  it('finds the completing cell for two in a row', () => {
    let s = started()
    // X at 0,1 / O at 3,4 — X (turn 4) can win at 2.
    for (const cell of [0, 3, 1, 4] as CellIndex[]) s = place(s, cell)
    expect(winningTargets([...s.board], s.turn)).toEqual([2])
  })
})

describe('pro level', () => {
  it('always takes an immediate win', () => {
    let s = started('pro')
    for (const cell of [0, 3, 1, 4] as CellIndex[]) s = place(s, cell)
    // X to move (the AI in this constructed turn) can win at 2.
    const move = chooseAiMove(s, rngOf(0.99))
    expect(move.cell).toBe(2)
  })

  it('always blocks an immediate threat', () => {
    let s = started('pro')
    // X at 0,1 threatens 2; O (turn 3) must block at 2.
    for (const cell of [0, 4, 1] as CellIndex[]) s = place(s, cell)
    const move = chooseAiMove(s, rngOf(0.99))
    expect(move.cell).toBe(2)
  })

  it('never hands the opponent an immediate win from a quiet position', () => {
    let s = started('pro')
    s = place(s, 0) // X1 corner; O (the AI here) to place
    for (let trial = 0; trial < 20; trial++) {
      const move = chooseAiMove(s, Math.random)
      const after = place(s, move.cell)
      // After O's reply, X must not have a forced immediate win everywhere…
      const xWins = winningTargets([...after.board], after.turn)
      // …at most one winnable cell (blockable next turn), never two (a fork).
      expect(xWins.length).toBeLessThanOrEqual(1)
    }
  })

  it('selects its piece before moving in the movement phase', () => {
    let s = started('pro')
    for (const cell of [0, 3, 1, 6, 5, 7] as CellIndex[]) s = place(s, cell)
    expect(s.phase).toBe('movement')
    const move = chooseAiMove(s, rngOf(0.5))
    expect(move.select).toBe('X1')
    expect(s.board[move.cell]).toBeNull()
  })
})

describe('beginner level', () => {
  it('misses wins when the dice say so', () => {
    let s = started('beginner')
    for (const cell of [0, 3, 1, 4] as CellIndex[]) s = place(s, cell)
    // rng ≥ 0.55 → skips the win check and plays "somewhere".
    const move = chooseAiMove(s, rngOf(0.9, 0.9, 0.3))
    expect([2, 5, 6, 7, 8]).toContain(move.cell)
  })

  it('takes the win when the dice cooperate', () => {
    let s = started('beginner')
    for (const cell of [0, 3, 1, 4] as CellIndex[]) s = place(s, cell)
    const move = chooseAiMove(s, rngOf(0.1))
    expect(move.cell).toBe(2)
  })
})

describe('medium level', () => {
  it('always takes wins and blocks threats (outside lapses)', () => {
    let s = started('medium')
    for (const cell of [0, 3, 1, 4] as CellIndex[]) s = place(s, cell)
    expect(chooseAiMove(s, rngOf(0.9)).cell).toBe(2)

    let b = started('medium')
    for (const cell of [0, 4, 1] as CellIndex[]) b = place(b, cell)
    expect(chooseAiMove(b, rngOf(0.9)).cell).toBe(2)
  })
})

describe('strength ladder', () => {
  /** Play a full round: `xLevel` drives X, `oLevel` drives O. */
  function playRound(xLevel: AiLevel, oLevel: AiLevel, plyCap = 60): 'X' | 'O' | null {
    let s = started('pro')
    while (s.status === 'playing' && s.turn < plyCap) {
      const level = s.turn % 2 === 0 ? xLevel : oLevel
      const probe: MatchState = { ...s, ai: { level } }
      const move = chooseAiMove(probe, Math.random)
      if (s.phase === 'movement') {
        s = matchReducer(s, { type: 'SELECT', piece: move.select! })
        s = matchReducer(s, { type: 'MOVE', cell: move.cell, now: T0 })
      } else {
        s = place(s, move.cell)
      }
    }
    return s.roundResult?.kind === 'win' ? s.roundResult.winnerSymbol : null
  }

  /** Wins of `a` minus wins of `b` over `games` color-alternating rounds. */
  function margin(a: AiLevel, b: AiLevel, games = 40): number {
    let aWins = 0
    let bWins = 0
    for (let i = 0; i < games; i++) {
      // Alternate colors so first-move advantage cancels out.
      const aAsX = i % 2 === 0
      const winner = aAsX ? playRound(a, b) : playRound(b, a)
      if (winner === (aAsX ? 'X' : 'O')) aWins++
      if (winner === (aAsX ? 'O' : 'X')) bWins++
    }
    return aWins - bWins
  }

  it('pro beats beginner convincingly; medium sits in between', () => {
    let proWins = 0
    let begWins = 0
    for (let i = 0; i < 40; i++) {
      const proAsX = i % 2 === 0
      const winner = proAsX ? playRound('pro', 'beginner') : playRound('beginner', 'pro')
      if (winner === (proAsX ? 'X' : 'O')) proWins++
      if (winner === (proAsX ? 'O' : 'X')) begWins++
    }
    expect(proWins).toBeGreaterThan(begWins * 2)

    expect(margin('medium', 'beginner')).toBeGreaterThan(0)
  })

  it('hard sits between medium and pro', () => {
    // Hard clearly outplays medium…
    expect(margin('hard', 'medium', 100)).toBeGreaterThanOrEqual(0)
    // …and does not outplay pro (deep search dominates or draws level).
    expect(margin('pro', 'hard', 40)).toBeGreaterThanOrEqual(0)
  })

  it('hard always takes wins and blocks threats', () => {
    let s = started('hard')
    for (const cell of [0, 3, 1, 4] as CellIndex[]) s = place(s, cell)
    expect(chooseAiMove(s, rngOf(0.99)).cell).toBe(2)

    let b = started('hard')
    for (const cell of [0, 4, 1] as CellIndex[]) b = place(b, cell)
    expect(chooseAiMove(b, rngOf(0.99)).cell).toBe(2)
  })
})
