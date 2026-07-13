/** Deterministic match reducer. Every action carries an explicit timestamp. */

import {
  freshClock,
  resolveTimeout,
  resetTurnTimer,
  settleClock,
  startClock,
  stopClock,
  type TimeoutResolution,
} from './clocks.ts'
import {
  emptyBoard,
  expectedPiece,
  findWin,
  isMoveValid,
  isPlacementValid,
  phaseForTurn,
  pieceCell,
  symbolOf,
} from './rules.ts'
import { DEFAULT_SPEED_TURN_MS, MAX_UNDOS_PER_ROUND } from './types.ts'
import type {
  ClockConfig,
  MatchAction,
  MatchConfig,
  MatchFormat,
  MatchState,
  PlayerId,
  RoundResult,
  Symbol_,
} from './types.ts'

export function winsNeededFor(format: MatchFormat): number | null {
  switch (format) {
    case 'best3':
      return 2
    case 'best5':
      return 3
    case 'best7':
      return 4
    case 'unlimited':
      return null
  }
}

/**
 * Force clock-config invariants: untimed has no turn limit, speed-round
 * always has one (that limit IS the mode).
 */
export function normalizeClockConfig(clock: ClockConfig): ClockConfig {
  if (clock.type === 'untimed') return { ...clock, turnLimitMs: null }
  if (clock.type === 'speed')
    return { ...clock, turnLimitMs: clock.turnLimitMs ?? DEFAULT_SPEED_TURN_MS }
  return clock
}

export function createMatch(
  players: { p1: string; p2: string },
  config: MatchConfig,
): MatchState {
  config = { ...config, clock: normalizeClockConfig(config.clock) }
  return {
    v: 5,
    players: { p1: players.p1, p2: players.p2 },
    config,
    winsNeeded: winsNeededFor(config.format),
    scores: { p1: 0, p2: 0 },
    roundNumber: 1,
    roundsPlayed: 0,
    p1Symbol: 'X',
    status: 'ready',
    paused: false,
    board: emptyBoard(),
    turn: 0,
    phase: 'placement',
    selected: null,
    clock: freshClock(config.clock),
    roundResult: null,
    matchResult: null,
    history: [],
    undosUsed: 0,
    undoRequest: null,
  }
}

export function playerForSymbol(state: MatchState, symbol: Symbol_): PlayerId {
  return state.p1Symbol === symbol ? 'p1' : 'p2'
}

export function symbolForPlayer(state: MatchState, player: PlayerId): Symbol_ {
  if (player === 'p1') return state.p1Symbol
  return state.p1Symbol === 'X' ? 'O' : 'X'
}

/** Symbol whose turn it currently is. */
export function activeSymbol(state: MatchState): Symbol_ {
  return symbolOf(expectedPiece(state.turn))
}

function resetRound(state: MatchState): MatchState {
  return {
    ...state,
    status: 'ready',
    paused: false,
    board: emptyBoard(),
    turn: 0,
    phase: 'placement',
    selected: null,
    clock: freshClock(state.config.clock),
    roundResult: null,
    history: [],
    undosUsed: 0,
    undoRequest: null,
  }
}

function finishRound(state: MatchState, result: RoundResult): MatchState {
  const scores = { ...state.scores }
  if (result.kind === 'win') scores[result.winner] += 1

  let next: MatchState = {
    ...state,
    scores,
    roundsPlayed: state.roundsPlayed + 1,
    status: 'roundComplete',
    paused: false,
    selected: null,
    roundResult: result,
    undoRequest: null,
  }

  if (next.winsNeeded !== null && result.kind === 'win' && scores[result.winner] >= next.winsNeeded) {
    next = {
      ...next,
      status: 'matchComplete',
      matchResult: {
        winner: result.winner,
        scores,
        roundsPlayed: next.roundsPlayed,
        endedManually: false,
      },
    }
  }
  return next
}

function applyTimeout(state: MatchState, hit: TimeoutResolution): MatchState {
  const active = activeSymbol(state)
  const clock = stopClock(state.clock, state.config.clock, active, hit.at)
  const base = { ...state, clock }
  const loserSymbol = active
  const winnerSymbol: Symbol_ = loserSymbol === 'X' ? 'O' : 'X'
  return finishRound(base, {
    kind: 'win',
    winner: playerForSymbol(state, winnerSymbol),
    winnerSymbol,
    reason: hit.reason,
    line: null,
  })
}

/** True while board interactions are allowed. */
function canAct(state: MatchState): boolean {
  return (
    state.status === 'playing' &&
    !state.paused &&
    state.roundResult === null &&
    state.undoRequest === null
  )
}

export function canRequestUndo(state: MatchState): boolean {
  return canAct(state) && state.history.length > 0 && state.undosUsed < MAX_UNDOS_PER_ROUND
}

/** Revert the last move and restart the clocks. Turn timer resets in full. */
function applyUndo(state: MatchState, now: number): MatchState {
  const entry = state.history[state.history.length - 1]
  if (!entry) return { ...state, undoRequest: null, clock: startClock(state.clock, now) }
  return {
    ...state,
    board: [...entry.board],
    turn: entry.turn,
    phase: phaseForTurn(entry.turn),
    selected: null,
    history: state.history.slice(0, -1),
    undosUsed: state.undosUsed + 1,
    undoRequest: null,
    clock: startClock(resetTurnTimer(state.clock, state.config.clock), now),
  }
}

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case 'START_ROUND': {
      if (state.status !== 'ready') return state
      return {
        ...state,
        status: 'playing',
        paused: false,
        clock: startClock(freshClock(state.config.clock), action.now),
      }
    }

    case 'PLACE': {
      if (!canAct(state)) return state
      const hit = resolveTimeout(state.clock, state.config.clock, activeSymbol(state), action.now)
      if (hit) return applyTimeout(state, hit)
      if (!isPlacementValid(state.board, state.turn, action.cell)) return state

      const piece = expectedPiece(state.turn)
      const board = [...state.board]
      board[action.cell] = piece

      const settled = settleClock(state.clock, state.config.clock, activeSymbol(state), action.now)
      const win = findWin(board)
      if (win) {
        const winner = playerForSymbol(state, win.symbol)
        return finishRound(
          {
            ...state,
            board,
            clock: { ...settled, runningSince: null },
          },
          { kind: 'win', winner, winnerSymbol: win.symbol, reason: 'line', line: win.line },
        )
      }

      const turn = state.turn + 1
      return {
        ...state,
        board,
        turn,
        phase: phaseForTurn(turn),
        clock: resetTurnTimer(settled, state.config.clock),
        history: [...state.history, { board: state.board, turn: state.turn }],
      }
    }

    case 'SELECT': {
      if (!canAct(state)) return state
      if (state.phase !== 'movement') return state
      if (action.piece !== expectedPiece(state.turn)) return state
      if (pieceCell(state.board, action.piece) === null) return state
      return { ...state, selected: action.piece }
    }

    case 'DESELECT': {
      if (!canAct(state)) return state
      return { ...state, selected: null }
    }

    case 'MOVE': {
      if (!canAct(state)) return state
      const hit = resolveTimeout(state.clock, state.config.clock, activeSymbol(state), action.now)
      if (hit) return applyTimeout(state, hit)
      const piece = state.selected
      if (piece === null) return state
      if (!isMoveValid(state.board, state.turn, piece, action.cell)) return state

      const from = pieceCell(state.board, piece)
      const board = [...state.board]
      if (from !== null) board[from] = null
      board[action.cell] = piece

      const settled = settleClock(state.clock, state.config.clock, activeSymbol(state), action.now)
      const win = findWin(board)
      if (win) {
        const winner = playerForSymbol(state, win.symbol)
        return finishRound(
          {
            ...state,
            board,
            selected: null,
            clock: { ...settled, runningSince: null },
          },
          { kind: 'win', winner, winnerSymbol: win.symbol, reason: 'line', line: win.line },
        )
      }

      const turn = state.turn + 1
      return {
        ...state,
        board,
        turn,
        selected: null,
        clock: resetTurnTimer(settled, state.config.clock),
        history: [...state.history, { board: state.board, turn: state.turn }],
      }
    }

    case 'PAUSE': {
      if (state.status !== 'playing' || state.paused || state.undoRequest !== null) return state
      return {
        ...state,
        paused: true,
        selected: null,
        clock: stopClock(state.clock, state.config.clock, activeSymbol(state), action.now),
      }
    }

    case 'RESUME': {
      if (state.status !== 'playing' || !state.paused || state.undoRequest !== null) return state
      return {
        ...state,
        paused: false,
        clock: startClock(state.clock, action.now),
      }
    }

    case 'CHECK_TIMEOUT': {
      if (!canAct(state)) return state
      const hit = resolveTimeout(state.clock, state.config.clock, activeSymbol(state), action.now)
      if (!hit) return state
      return applyTimeout(state, hit)
    }

    case 'RESTART_ROUND': {
      if (state.status !== 'playing' && state.status !== 'ready') return state
      return resetRound(state)
    }

    case 'END_ROUND_MANUAL': {
      if (state.status !== 'playing') return state
      const stopped = stopClock(state.clock, state.config.clock, activeSymbol(state), action.now)
      return finishRound({ ...state, clock: stopped }, { kind: 'draw', reason: 'manual' })
    }

    case 'NEXT_ROUND': {
      if (state.status !== 'roundComplete') return state
      return {
        ...resetRound(state),
        roundNumber: state.roundNumber + 1,
        // Symbols swap; colors follow the players. X always starts.
        p1Symbol: state.p1Symbol === 'X' ? 'O' : 'X',
      }
    }

    case 'REQUEST_UNDO': {
      if (!canRequestUndo(state)) return state
      return {
        ...state,
        selected: null,
        undoRequest: { approvals: { p1: false, p2: false } },
        clock: stopClock(state.clock, state.config.clock, activeSymbol(state), action.now),
      }
    }

    case 'APPROVE_UNDO': {
      if (state.status !== 'playing' || state.undoRequest === null) return state
      const approvals = { ...state.undoRequest.approvals, [action.player]: true }
      if (approvals.p1 && approvals.p2) return applyUndo(state, action.now)
      return { ...state, undoRequest: { approvals } }
    }

    case 'CANCEL_UNDO': {
      if (state.status !== 'playing' || state.undoRequest === null) return state
      return {
        ...state,
        undoRequest: null,
        clock: startClock(state.clock, action.now),
      }
    }

    case 'END_MATCH': {
      if (state.status === 'matchComplete') return state
      const { p1, p2 } = state.scores
      const winner: PlayerId | null = p1 > p2 ? 'p1' : p2 > p1 ? 'p2' : null
      return {
        ...state,
        status: 'matchComplete',
        paused: false,
        selected: null,
        undoRequest: null,
        clock: { ...state.clock, runningSince: null },
        matchResult: {
          winner,
          scores: { ...state.scores },
          roundsPlayed: state.roundsPlayed,
          endedManually: true,
        },
      }
    }
  }
}
