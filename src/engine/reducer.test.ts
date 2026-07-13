import { describe, expect, it } from 'vitest'
import { activeSymbol, createMatch, matchReducer, playerForSymbol, winsNeededFor } from './reducer.ts'
import { remaining } from './clocks.ts'
import type { CellIndex, MatchConfig, MatchState, PieceId } from './types.ts'

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

function newMatch(overrides: Partial<MatchConfig> = {}): MatchState {
  return createMatch({ p1: 'Ada', p2: 'Grace' }, config(overrides))
}

function started(overrides: Partial<MatchConfig> = {}, now = T0): MatchState {
  return matchReducer(newMatch(overrides), { type: 'START_ROUND', now })
}

function place(state: MatchState, cell: CellIndex, now = T0): MatchState {
  return matchReducer(state, { type: 'PLACE', cell, now })
}

function move(state: MatchState, piece: PieceId, cell: CellIndex, now = T0): MatchState {
  const selected = matchReducer(state, { type: 'SELECT', piece })
  return matchReducer(selected, { type: 'MOVE', cell, now })
}

/** Places six pieces with no winner: X on 0,4,5 / O on 3,1,8. */
function placeAllNoWin(state: MatchState, now = T0): MatchState {
  let s = state
  for (const cell of [0, 3, 4, 1, 5, 8] as CellIndex[]) {
    s = place(s, cell, now)
  }
  return s
}

describe('winsNeededFor', () => {
  it('maps formats to required wins', () => {
    expect(winsNeededFor('best3')).toBe(2)
    expect(winsNeededFor('best5')).toBe(3)
    expect(winsNeededFor('best7')).toBe(4)
    expect(winsNeededFor('unlimited')).toBeNull()
  })
})

describe('placement', () => {
  it('places pieces in the exact order X1 O1 X2 O2 X3 O3', () => {
    let s = started()
    const cells: CellIndex[] = [0, 3, 4, 1, 5, 8]
    const order: PieceId[] = ['X1', 'O1', 'X2', 'O2', 'X3', 'O3']
    cells.forEach((cell, i) => {
      s = place(s, cell)
      expect(s.board[cell]).toBe(order[i])
    })
    expect(s.turn).toBe(6)
  })

  it('rejects placement on an occupied cell without advancing the turn', () => {
    let s = started()
    s = place(s, 0)
    const after = place(s, 0)
    expect(after).toBe(s)
    expect(after.turn).toBe(1)
  })

  it('ignores placements before the round starts', () => {
    const s = newMatch()
    expect(place(s, 0)).toBe(s)
  })

  it('detects a placement win immediately and awards the point', () => {
    let s = started()
    // X: 0, 1, 2 — O: 3, 4
    for (const cell of [0, 3, 1, 4] as CellIndex[]) s = place(s, cell)
    s = place(s, 2)
    expect(s.status).toBe('roundComplete')
    expect(s.roundResult).toMatchObject({
      kind: 'win',
      winnerSymbol: 'X',
      reason: 'line',
      line: [0, 1, 2],
    })
    expect(s.scores.p1).toBe(1)
    expect(s.scores.p2).toBe(0)
  })

  it('transitions to movement phase after O3 with no winner', () => {
    const s = placeAllNoWin(started())
    expect(s.phase).toBe('movement')
    expect(s.status).toBe('playing')
    expect(s.roundResult).toBeNull()
  })
})

describe('movement', () => {
  it('moves only via select-then-move and repeats the piece order', () => {
    let s = placeAllNoWin(started())
    // Direct MOVE without selection is ignored.
    expect(matchReducer(s, { type: 'MOVE', cell: 2, now: T0 })).toBe(s)

    s = move(s, 'X1', 2) // X1: 0 -> 2
    expect(s.board[0]).toBeNull()
    expect(s.board[2]).toBe('X1')
    expect(s.turn).toBe(7)

    s = move(s, 'O1', 0) // O1: 3 -> 0
    expect(s.board[0]).toBe('O1')
    s = move(s, 'X2', 3) // X2: 4 -> 3
    s = move(s, 'O2', 6) // O2: 1 -> 6
    s = move(s, 'X3', 4) // X3: 5 -> 4
    s = move(s, 'O3', 7) // O3: 8 -> 7
    // Order wraps back to X1.
    expect(s.turn).toBe(12)
    const sel = matchReducer(s, { type: 'SELECT', piece: 'X1' })
    expect(sel.selected).toBe('X1')
  })

  it('rejects selecting or moving the wrong piece', () => {
    const s = placeAllNoWin(started())
    expect(matchReducer(s, { type: 'SELECT', piece: 'O1' })).toBe(s)
    expect(matchReducer(s, { type: 'SELECT', piece: 'X2' })).toBe(s)
    const after = move(s, 'X2', 2)
    expect(after.board[2]).toBeNull()
  })

  it('rejects moving onto an occupied cell and onto its own cell', () => {
    const s = placeAllNoWin(started())
    const ontoOccupied = move(s, 'X1', 3)
    expect(ontoOccupied.turn).toBe(6)
    const ontoSelf = move(s, 'X1', 0)
    expect(ontoSelf.turn).toBe(6)
  })

  it('allows deselecting by DESELECT', () => {
    const s = placeAllNoWin(started())
    const sel = matchReducer(s, { type: 'SELECT', piece: 'X1' })
    const desel = matchReducer(sel, { type: 'DESELECT' })
    expect(desel.selected).toBeNull()
  })

  it('detects a win after a movement', () => {
    // Place X on 0,1,5 and O on 3,6,7 (no winner), then win column 2-5-8.
    let s = started()
    for (const cell of [0, 3, 1, 6, 5, 7] as CellIndex[]) s = place(s, cell)
    expect(s.phase).toBe('movement')
    s = move(s, 'X1', 2) // X1: 0 -> 2
    s = move(s, 'O1', 4) // O1: 3 -> 4
    s = move(s, 'X2', 8) // X2: 1 -> 8 completes X on 2, 5, 8
    expect(s.status).toBe('roundComplete')
    expect(s.roundResult).toMatchObject({
      kind: 'win',
      winnerSymbol: 'X',
      reason: 'line',
      line: [2, 5, 8],
    })
  })

  it('never allows more than three pieces per symbol', () => {
    let s = placeAllNoWin(started())
    s = move(s, 'X1', 2)
    const xs = s.board.filter((p) => p?.startsWith('X'))
    const os = s.board.filter((p) => p?.startsWith('O'))
    expect(xs).toHaveLength(3)
    expect(os).toHaveLength(3)
    expect(new Set(s.board.filter(Boolean)).size).toBe(6)
  })
})

describe('rounds and match scoring', () => {
  function winRoundForX(state: MatchState): MatchState {
    let s = state
    for (const cell of [0, 3, 1, 4] as CellIndex[]) s = place(s, cell)
    return place(s, 2)
  }

  it('swaps symbols between rounds while X always starts', () => {
    let s = winRoundForX(started())
    expect(s.p1Symbol).toBe('X')
    s = matchReducer(s, { type: 'NEXT_ROUND' })
    expect(s.roundNumber).toBe(2)
    // Player 2 holds X in round 2 and therefore starts.
    expect(s.p1Symbol).toBe('O')
    expect(playerForSymbol(s, 'X')).toBe('p2')
    expect(activeSymbol(s)).toBe('X')
    s = matchReducer(s, { type: 'START_ROUND', now: T0 })
    const afterFirst = matchReducer(s, { type: 'PLACE', cell: 0, now: T0 })
    expect(afterFirst.board[0]).toBe('X1')
  })

  it('restarts a round without swapping symbols or advancing the round number', () => {
    let s = started()
    s = place(s, 0)
    s = matchReducer(s, { type: 'RESTART_ROUND' })
    expect(s.roundNumber).toBe(1)
    expect(s.p1Symbol).toBe('X')
    expect(s.board.every((c) => c === null)).toBe(true)
    expect(s.status).toBe('ready')
    expect(s.turn).toBe(0)
    expect(s.scores).toEqual({ p1: 0, p2: 0 })
  })

  it('ends a round manually as a draw with no point', () => {
    let s = started()
    s = place(s, 0)
    s = matchReducer(s, { type: 'END_ROUND_MANUAL', now: T0 })
    expect(s.status).toBe('roundComplete')
    expect(s.roundResult).toEqual({ kind: 'draw', reason: 'manual' })
    expect(s.scores).toEqual({ p1: 0, p2: 0 })
    s = matchReducer(s, { type: 'NEXT_ROUND' })
    expect(s.roundNumber).toBe(2)
    // Symbols still swap after an abandoned round.
    expect(s.p1Symbol).toBe('O')
  })

  it('completes a best-of-3 when a player reaches 2 wins', () => {
    let s = winRoundForX(started()) // p1 (X) wins round 1
    s = matchReducer(s, { type: 'NEXT_ROUND' })
    s = matchReducer(s, { type: 'START_ROUND', now: T0 })
    s = winRoundForX(s) // X wins again, but X is now p2
    expect(s.scores).toEqual({ p1: 1, p2: 1 })
    expect(s.status).toBe('roundComplete')
    s = matchReducer(s, { type: 'NEXT_ROUND' })
    s = matchReducer(s, { type: 'START_ROUND', now: T0 })
    s = winRoundForX(s) // round 3: p1 is X again
    expect(s.scores).toEqual({ p1: 2, p2: 1 })
    expect(s.status).toBe('matchComplete')
    expect(s.matchResult).toMatchObject({ winner: 'p1', roundsPlayed: 3, endedManually: false })
  })

  it('completes best-of-5 at 3 wins and best-of-7 at 4 wins', () => {
    for (const [format, needed] of [
      ['best5', 3],
      ['best7', 4],
    ] as const) {
      let s = started({ format })
      let safety = 0
      while (s.status !== 'matchComplete' && safety++ < 20) {
        if (s.status === 'ready') s = matchReducer(s, { type: 'START_ROUND', now: T0 })
        const xPlayer = playerForSymbol(s, 'X')
        s = winRoundForX(s)
        if (s.status === 'roundComplete') {
          expect(s.scores[xPlayer]).toBeLessThan(needed)
          s = matchReducer(s, { type: 'NEXT_ROUND' })
        }
      }
      expect(s.status).toBe('matchComplete')
      expect(Math.max(s.matchResult!.scores.p1, s.matchResult!.scores.p2)).toBe(needed)
    }
  })

  it('never auto-completes an unlimited match', () => {
    let s = started({ format: 'unlimited' })
    for (let i = 0; i < 10; i++) {
      if (s.status === 'ready') s = matchReducer(s, { type: 'START_ROUND', now: T0 })
      s = winRoundForX(s)
      expect(s.status).toBe('roundComplete')
      s = matchReducer(s, { type: 'NEXT_ROUND' })
    }
    expect(s.scores.p1 + s.scores.p2).toBe(10)
  })

  it('ends an unlimited match manually, awarding the leader the win', () => {
    let s = winRoundForX(started({ format: 'unlimited' }))
    s = matchReducer(s, { type: 'NEXT_ROUND' })
    s = matchReducer(s, { type: 'END_MATCH' })
    expect(s.status).toBe('matchComplete')
    expect(s.matchResult).toMatchObject({ winner: 'p1', endedManually: true })
  })

  it('ends a tied match manually with no winner', () => {
    let s = started({ format: 'unlimited' })
    s = matchReducer(s, { type: 'END_MATCH' })
    expect(s.matchResult).toMatchObject({ winner: null, endedManually: true })
  })

  it('ignores further board actions after the round is complete', () => {
    let s = started()
    for (const cell of [0, 3, 1, 4] as CellIndex[]) s = place(s, cell)
    s = place(s, 2)
    expect(s.status).toBe('roundComplete')
    const after = place(s, 5)
    expect(after).toBe(s)
    expect(matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 10_000_000 })).toBe(s)
  })
})

describe('timers', () => {
  it('expires the turn timer and awards the round to the opponent', () => {
    let s = started({ clock: { type: 'speed', duelMs: 120_000, turnLimitMs: 10_000 } })
    s = matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 9_999 })
    expect(s.status).toBe('playing')
    s = matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 10_000 })
    expect(s.status).toBe('roundComplete')
    expect(s.roundResult).toMatchObject({ kind: 'win', winnerSymbol: 'O', reason: 'turnTimeout' })
    expect(s.scores.p2).toBe(1)
  })

  it('resets the turn timer after every valid action', () => {
    let s = started({ clock: { type: 'speed', duelMs: 120_000, turnLimitMs: 10_000 } })
    s = place(s, 0, T0 + 9_000)
    // 9s elapsed but timer was reset; at T0+18s only 9s of the new turn have passed.
    s = matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 18_000 })
    expect(s.status).toBe('playing')
    s = matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 19_000 })
    expect(s.status).toBe('roundComplete')
    expect(s.roundResult).toMatchObject({ reason: 'turnTimeout', winnerSymbol: 'X' })
  })

  it('a move attempted after the deadline resolves the timeout instead', () => {
    let s = started({ clock: { type: 'speed', duelMs: 120_000, turnLimitMs: 10_000 } })
    s = place(s, 0, T0 + 10_001)
    expect(s.board[0]).toBeNull()
    expect(s.roundResult).toMatchObject({ reason: 'turnTimeout' })
  })

  it('speed round is turn-limit only: the limit is defaulted and losing it loses the round', () => {
    // A speed config without an explicit limit gets the 10s default.
    let s = started({ clock: { type: 'speed', duelMs: 120_000, turnLimitMs: null } })
    expect(s.config.clock.turnLimitMs).toBe(10_000)
    s = matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 9_999 })
    expect(s.status).toBe('playing')
    s = matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 10_000 })
    expect(s.status).toBe('roundComplete')
    // No draw: the active player (X) loses on timeout.
    expect(s.roundResult).toMatchObject({ kind: 'win', winnerSymbol: 'O', reason: 'turnTimeout' })
  })

  it('untimed mode never has a turn limit', () => {
    const s = started({ clock: { type: 'untimed', duelMs: 120_000, turnLimitMs: 10_000 } })
    expect(s.config.clock.turnLimitMs).toBeNull()
    expect(matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 999_999 })).toBe(s)
  })

  it('only charges the active player on the duel clock and switches after moves', () => {
    let s = started({ clock: { type: 'duel', duelMs: 60_000, turnLimitMs: null } })
    s = place(s, 0, T0 + 10_000) // X thought for 10s
    let r = remaining(s.clock, s.config.clock, activeSymbol(s), T0 + 10_000)
    expect(r.duelMs.X).toBe(50_000)
    expect(r.duelMs.O).toBe(60_000)
    s = place(s, 3, T0 + 25_000) // O thought for 15s
    r = remaining(s.clock, s.config.clock, activeSymbol(s), T0 + 25_000)
    expect(r.duelMs.X).toBe(50_000)
    expect(r.duelMs.O).toBe(45_000)
  })

  it('expires the duel clock and the flagged player loses', () => {
    let s = started({ clock: { type: 'duel', duelMs: 60_000, turnLimitMs: null } })
    s = place(s, 0, T0 + 10_000) // X used 10s; O to act
    s = matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 70_001 })
    expect(s.status).toBe('roundComplete')
    expect(s.roundResult).toMatchObject({ kind: 'win', winnerSymbol: 'X', reason: 'duelTimeout' })
  })

  it('resolves near-simultaneous deadlines by actual expiry timestamp', () => {
    // Turn limit 10s, duel 60s: X waits; at T0+10s turn expires before duel.
    let s = started({ clock: { type: 'duel', duelMs: 60_000, turnLimitMs: 10_000 } })
    s = matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 61_000 })
    expect(s.roundResult).toMatchObject({ reason: 'turnTimeout' })

    // Duel 5s, turn limit 10s: duel expires first.
    let d = started({ clock: { type: 'duel', duelMs: 5_000, turnLimitMs: 10_000 } })
    d = matchReducer(d, { type: 'CHECK_TIMEOUT', now: T0 + 12_000 })
    expect(d.roundResult).toMatchObject({ reason: 'duelTimeout' })

    // Exact tie between turn limit and duel clock: turn limit wins the tie.
    let t = started({ clock: { type: 'duel', duelMs: 10_000, turnLimitMs: 10_000 } })
    t = matchReducer(t, { type: 'CHECK_TIMEOUT', now: T0 + 10_000 })
    expect(t.roundResult).toMatchObject({ reason: 'turnTimeout' })
  })

  it('processes a timeout only once', () => {
    let s = started({ clock: { type: 'speed', duelMs: 120_000, turnLimitMs: 10_000 } })
    s = matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 10_000 })
    const again = matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 10_500 })
    expect(again).toBe(s)
    expect(again.scores.p2).toBe(1)
  })

  it('does not run any clock before the round starts', () => {
    const s = newMatch({ clock: { type: 'speed', duelMs: 120_000, turnLimitMs: 10_000 } })
    const later = matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 999_999 })
    expect(later).toBe(s)
  })
})

describe('pause and resume', () => {
  it('freezes all clocks while paused and resumes accurately', () => {
    let s = started({ clock: { type: 'speed', duelMs: 120_000, turnLimitMs: 30_000 } })
    s = matchReducer(s, { type: 'PAUSE', now: T0 + 10_000 })
    expect(s.paused).toBe(true)
    // A long pause consumes no game time.
    s = matchReducer(s, { type: 'RESUME', now: T0 + 500_000 })
    expect(s.paused).toBe(false)
    const r = remaining(s.clock, s.config.clock, activeSymbol(s), T0 + 500_000)
    expect(r.turnMs).toBe(20_000)
  })

  it('ignores board actions and timeouts while paused', () => {
    let s = started({ clock: { type: 'speed', duelMs: 120_000, turnLimitMs: 10_000 } })
    s = matchReducer(s, { type: 'PAUSE', now: T0 + 1_000 })
    expect(place(s, 0, T0 + 2_000)).toBe(s)
    expect(matchReducer(s, { type: 'CHECK_TIMEOUT', now: T0 + 999_999 })).toBe(s)
  })

  it('clears any selection when pausing', () => {
    let s = placeAllNoWin(started())
    s = matchReducer(s, { type: 'SELECT', piece: 'X1' })
    s = matchReducer(s, { type: 'PAUSE', now: T0 })
    expect(s.selected).toBeNull()
  })
})
