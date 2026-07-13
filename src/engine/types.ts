/** Pure, serializable types for the Speed Tic Tac Toe engine. */

export type Symbol_ = 'X' | 'O'

export type PieceId = 'X1' | 'X2' | 'X3' | 'O1' | 'O2' | 'O3'

/** Cell index 0..8, row-major (0 = top-left as seen by Player 1). */
export type CellIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/** board[cell] = piece occupying it, or null. */
export type Board = (PieceId | null)[]

export type PlayerId = 'p1' | 'p2'

export type MatchFormat = 'best3' | 'best5' | 'best7' | 'unlimited'

export type ClockType = 'untimed' | 'speed' | 'duel'

export interface ClockConfig {
  type: ClockType
  /** Per-player starting time for duel clocks, in ms. */
  duelMs: number
  /**
   * Per-turn limit in ms. Always null for 'untimed', always set for 'speed'
   * (it IS the speed-round mode), optional for 'duel'. Enforced by
   * normalizeClockConfig at match creation.
   */
  turnLimitMs: number | null
}

export interface MatchConfig {
  format: MatchFormat
  clock: ClockConfig
  sound: boolean
  haptics: boolean
}

export type RoundPhase = 'placement' | 'movement'

export type RoundEndReason = 'line' | 'turnTimeout' | 'duelTimeout' | 'manual'

export type RoundResult =
  | {
      kind: 'win'
      winner: PlayerId
      winnerSymbol: Symbol_
      reason: Exclude<RoundEndReason, 'manual'>
      /** Winning line cells when reason === 'line'. */
      line: CellIndex[] | null
    }
  | { kind: 'draw'; reason: 'manual' }

export interface MatchResult {
  /** null = ended manually with tied scores (no winner). */
  winner: PlayerId | null
  scores: Record<PlayerId, number>
  roundsPlayed: number
  endedManually: boolean
}

/**
 * Clock bookkeeping. Remaining values are the amounts left the last time the
 * clocks were settled. While `runningSince` is a timestamp, the live remaining
 * value is `stored - (now - runningSince)` for each clock that is running.
 */
export interface ClockState {
  /** Timestamp (ms epoch) when clocks started running, or null when stopped. */
  runningSince: number | null
  /** Duel clock remaining per symbol, ms (only meaningful for 'duel'). */
  duelMs: Record<Symbol_, number>
  /** Turn timer remaining, ms (only meaningful when turnLimitMs !== null). */
  turnMs: number
}

export type MatchStatus =
  | 'ready' // between rounds, waiting for "Start round"
  | 'playing'
  | 'roundComplete'
  | 'matchComplete'

/** Snapshot taken before each successful placement/move, for undo. */
export interface HistoryEntry {
  board: Board
  turn: number
}

/** A pending undo that both players must approve. */
export interface UndoRequest {
  approvals: Record<PlayerId, boolean>
}

export const MAX_UNDOS_PER_ROUND = 3

export interface MatchState {
  /** Schema version for persistence. */
  v: 5
  players: Record<PlayerId, string>
  config: MatchConfig
  winsNeeded: number | null
  scores: Record<PlayerId, number>
  roundNumber: number
  roundsPlayed: number
  /**
   * Which symbol Player 1 holds this round; swaps every round. Colors follow
   * the PLAYER (P1 cyan, P2 orange), not the symbol — X always starts.
   */
  p1Symbol: Symbol_
  status: MatchStatus
  paused: boolean
  board: Board
  /** Zero-based count of successful actions this round; expected piece = order[turn % 6]. */
  turn: number
  phase: RoundPhase
  /** Piece currently selected for movement, or null. */
  selected: PieceId | null
  clock: ClockState
  roundResult: RoundResult | null
  matchResult: MatchResult | null
  /** Move history for the current round (most recent last). */
  history: HistoryEntry[]
  /** Undos consumed this round (max MAX_UNDOS_PER_ROUND). */
  undosUsed: number
  /** Pending undo approval, or null. Clocks are stopped while it is open. */
  undoRequest: UndoRequest | null
}

export type MatchAction =
  | { type: 'START_ROUND'; now: number }
  | { type: 'PLACE'; cell: CellIndex; now: number }
  | { type: 'SELECT'; piece: PieceId }
  | { type: 'DESELECT' }
  | { type: 'MOVE'; cell: CellIndex; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'CHECK_TIMEOUT'; now: number }
  | { type: 'RESTART_ROUND' }
  | { type: 'END_ROUND_MANUAL'; now: number }
  | { type: 'NEXT_ROUND' }
  | { type: 'END_MATCH' }
  | { type: 'REQUEST_UNDO'; now: number }
  | { type: 'APPROVE_UNDO'; player: PlayerId; now: number }
  | { type: 'CANCEL_UNDO'; now: number }

/** All piece ids (for iteration/validation, not turn order). */
export const ALL_PIECES: readonly PieceId[] = ['X1', 'X2', 'X3', 'O1', 'O2', 'O3']

/** Fixed turn order: X always starts every round. */
export const PIECE_ORDER: readonly PieceId[] = ['X1', 'O1', 'X2', 'O2', 'X3', 'O3']

export const WIN_LINES: readonly (readonly [CellIndex, CellIndex, CellIndex])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

/** Default per-turn limit for the speed-round mode. */
export const DEFAULT_SPEED_TURN_MS = 10_000
