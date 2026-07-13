/** Pure rule helpers: piece order, placement/movement validation, win detection. */

import {
  pieceOrder,
  WIN_LINES,
  type Board,
  type CellIndex,
  type PieceId,
  type RoundPhase,
  type Symbol_,
} from './types.ts'

export function symbolOf(piece: PieceId): Symbol_ {
  return piece[0] === 'X' ? 'X' : 'O'
}

/** Piece expected to act on the given turn (0-based, spans both phases). */
export function expectedPiece(turn: number, startingSymbol: Symbol_): PieceId {
  const piece = pieceOrder(startingSymbol)[((turn % 6) + 6) % 6]
  if (!piece) throw new Error('unreachable')
  return piece
}

/** Piece that acts after the given turn. */
export function followingPiece(turn: number, startingSymbol: Symbol_): PieceId {
  return expectedPiece(turn + 1, startingSymbol)
}

/** Phase for a given turn count: turns 0..5 are placements. */
export function phaseForTurn(turn: number): RoundPhase {
  return turn < 6 ? 'placement' : 'movement'
}

export function isPlacementValid(board: Board, turn: number, cell: CellIndex): boolean {
  return phaseForTurn(turn) === 'placement' && board[cell] === null
}

export function pieceCell(board: Board, piece: PieceId): CellIndex | null {
  const i = board.indexOf(piece)
  return i === -1 ? null : (i as CellIndex)
}

export function isMoveValid(
  board: Board,
  turn: number,
  piece: PieceId,
  cell: CellIndex,
  startingSymbol: Symbol_,
): boolean {
  if (phaseForTurn(turn) !== 'movement') return false
  if (piece !== expectedPiece(turn, startingSymbol)) return false
  const from = pieceCell(board, piece)
  if (from === null) return false
  if (cell === from) return false
  return board[cell] === null
}

/** All empty cells the given piece may move to (empty if it is not its turn). */
export function validDestinations(
  board: Board,
  turn: number,
  piece: PieceId,
  startingSymbol: Symbol_,
): CellIndex[] {
  if (phaseForTurn(turn) !== 'movement' || piece !== expectedPiece(turn, startingSymbol))
    return []
  const out: CellIndex[] = []
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) out.push(i as CellIndex)
  }
  return out
}

/** Returns the winning symbol and line, or null. Checks all eight lines. */
export function findWin(board: Board): { symbol: Symbol_; line: CellIndex[] } | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line
    const pa = board[a]
    const pb = board[b]
    const pc = board[c]
    if (pa && pb && pc && symbolOf(pa) === symbolOf(pb) && symbolOf(pb) === symbolOf(pc)) {
      return { symbol: symbolOf(pa), line: [...line] }
    }
  }
  return null
}

export function emptyBoard(): Board {
  return Array(9).fill(null)
}
