/**
 * Computer opponent. Pure and deterministic given an injected RNG.
 *
 * Levels roughly follow chess skill:
 *  - beginner ≈ 800 Elo: mostly random; often misses wins and blocks
 *  - medium   ≈ 1400 Elo: takes wins, blocks threats, avoids blunders,
 *    with occasional human-like lapses
 *  - pro      ≈ 2200 Elo: depth-8 alpha-beta search, near-perfect play
 */

import { expectedPiece, findWin, phaseForTurn, pieceCell } from './rules.ts'
import type { Board, CellIndex, MatchState, PieceId } from './types.ts'

export type AiLevel = 'beginner' | 'medium' | 'pro'

export const AI_LEVELS: { value: AiLevel; label: string; elo: string }[] = [
  { value: 'beginner', label: 'Beginner', elo: '≈ 800 Elo' },
  { value: 'medium', label: 'Medium', elo: '≈ 1400 Elo' },
  { value: 'pro', label: 'Pro', elo: '≈ 2200 Elo' },
]

export function aiDisplayName(level: AiLevel): string {
  const meta = AI_LEVELS.find((l) => l.value === level)
  return `Computer · ${meta?.label ?? level}`
}

/** The move the computer wants to play: select (movement phase only) + target. */
export interface AiMove {
  select: PieceId | null
  cell: CellIndex
}

type Rng = () => number

function legalTargets(board: Board): CellIndex[] {
  // Empty cells; in the movement phase the piece's own cell is occupied by
  // itself and therefore never listed.
  const out: CellIndex[] = []
  for (let i = 0; i < 9; i++) if (board[i] === null) out.push(i as CellIndex)
  return out
}

/** Apply the expected piece's action onto `board` in place; returns undo info. */
function applyMove(board: Board, turn: number, cell: CellIndex): CellIndex | null {
  const piece = expectedPiece(turn)
  const from = phaseForTurn(turn) === 'movement' ? pieceCell(board, piece) : null
  if (from !== null) board[from] = null
  board[cell] = piece
  return from
}

function undoMove(board: Board, turn: number, cell: CellIndex, from: CellIndex | null): void {
  const piece = expectedPiece(turn)
  board[cell] = null
  if (from !== null) board[from] = piece
}

/** Targets that win immediately for the mover of `turn`. */
export function winningTargets(board: Board, turn: number): CellIndex[] {
  const wins: CellIndex[] = []
  for (const cell of legalTargets(board)) {
    const from = applyMove(board, turn, cell)
    if (findWin(board)) wins.push(cell)
    undoMove(board, turn, cell, from)
  }
  return wins
}

/** Targets after which the NEXT mover has no immediate winning reply. */
function safeTargets(board: Board, turn: number): CellIndex[] {
  const safe: CellIndex[] = []
  for (const cell of legalTargets(board)) {
    const from = applyMove(board, turn, cell)
    const replies = findWin(board) ? [] : winningTargets(board, turn + 1)
    undoMove(board, turn, cell, from)
    if (replies.length === 0) safe.push(cell)
  }
  return safe
}

/** Win/loss negamax with alpha-beta; faster wins score higher. */
function negamax(board: Board, turn: number, depth: number, alpha: number, beta: number): number {
  let best = -Infinity
  for (const cell of legalTargets(board)) {
    const from = applyMove(board, turn, cell)
    let score: number
    if (findWin(board)) score = 1000 - depth
    else if (depth <= 1) score = 0
    else score = -negamax(board, turn + 1, depth - 1, -beta, -alpha)
    undoMove(board, turn, cell, from)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best === -Infinity ? 0 : best
}

/** Positional flavor for tie-breaks: center > corners > edges. */
const CELL_WEIGHT = [1, 0, 1, 0, 2, 0, 1, 0, 1]

function pick<T>(arr: T[], rng: Rng): T {
  const item = arr[Math.floor(rng() * arr.length) % arr.length]
  if (item === undefined) throw new Error('pick from empty list')
  return item
}

function bestByWeight(cells: CellIndex[], rng: Rng): CellIndex {
  const top = Math.max(...cells.map((c) => CELL_WEIGHT[c] ?? 0))
  return pick(
    cells.filter((c) => (CELL_WEIGHT[c] ?? 0) === top),
    rng,
  )
}

function chooseCell(board: Board, turn: number, level: AiLevel, rng: Rng): CellIndex {
  const legal = legalTargets(board)
  const wins = winningTargets(board, turn)
  const threats = winningTargets(board, turn + 1)

  if (level === 'beginner') {
    // Sees an immediate win a bit over half the time, rarely thinks to block.
    if (wins.length && rng() < 0.55) return pick(wins, rng)
    const blocks = legal.filter((c) => threats.includes(c))
    if (blocks.length && rng() < 0.25) return pick(blocks, rng)
    return pick(legal, rng)
  }

  if (level === 'medium') {
    if (wins.length) return pick(wins, rng)
    // Occasional lapse keeps it beatable (~1 in 8 non-winning moves).
    if (rng() < 0.125) return pick(legal, rng)
    const blocks = legal.filter((c) => threats.includes(c))
    if (blocks.length) return pick(blocks, rng)
    const safe = safeTargets(board, turn)
    return safe.length ? bestByWeight(safe, rng) : pick(legal, rng)
  }

  // pro: full search, positional tie-breaks among equal-best moves.
  let bestScore = -Infinity
  let best: CellIndex[] = []
  for (const cell of legal) {
    const from = applyMove(board, turn, cell)
    const score = findWin(board) ? 1000 : -negamax(board, turn + 1, 8, -Infinity, Infinity)
    undoMove(board, turn, cell, from)
    if (score > bestScore) {
      bestScore = score
      best = [cell]
    } else if (score === bestScore) best.push(cell)
  }
  return best.length ? bestByWeight(best, rng) : pick(legal, rng)
}

/**
 * Decide the computer's move for the current state. Callers must ensure it is
 * actually the computer's turn in an active round.
 */
export function chooseAiMove(state: MatchState, rng: Rng = Math.random): AiMove {
  const board = [...state.board]
  const cell = chooseCell(board, state.turn, state.ai?.level ?? 'medium', rng)
  const select = state.phase === 'movement' ? expectedPiece(state.turn) : null
  return { select, cell }
}
