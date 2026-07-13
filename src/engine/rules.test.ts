import { describe, expect, it } from 'vitest'
import {
  emptyBoard,
  expectedPiece,
  findWin,
  followingPiece,
  isMoveValid,
  isPlacementValid,
  phaseForTurn,
  validDestinations,
} from './rules.ts'
import type { Board, CellIndex, PieceId } from './types.ts'

function boardWith(entries: Partial<Record<CellIndex, PieceId>>): Board {
  const b = emptyBoard()
  for (const [cell, piece] of Object.entries(entries)) {
    b[Number(cell)] = piece as PieceId
  }
  return b
}

describe('expectedPiece / followingPiece', () => {
  it('follows X1 O1 X2 O2 X3 O3 during placement — X always starts', () => {
    expect([0, 1, 2, 3, 4, 5].map((t) => expectedPiece(t))).toEqual([
      'X1',
      'O1',
      'X2',
      'O2',
      'X3',
      'O3',
    ])
  })

  it('repeats the same order forever during movement', () => {
    expect([6, 7, 8, 9, 10, 11, 12].map((t) => expectedPiece(t))).toEqual([
      'X1',
      'O1',
      'X2',
      'O2',
      'X3',
      'O3',
      'X1',
    ])
  })

  it('reports the following piece', () => {
    expect(followingPiece(0)).toBe('O1')
    expect(followingPiece(5)).toBe('X1')
    expect(followingPiece(11)).toBe('X1')
  })
})

describe('phaseForTurn', () => {
  it('is placement for the first six turns and movement after', () => {
    expect(phaseForTurn(0)).toBe('placement')
    expect(phaseForTurn(5)).toBe('placement')
    expect(phaseForTurn(6)).toBe('movement')
    expect(phaseForTurn(60)).toBe('movement')
  })
})

describe('isPlacementValid', () => {
  it('accepts an empty cell during placement', () => {
    expect(isPlacementValid(emptyBoard(), 0, 4)).toBe(true)
  })

  it('rejects an occupied cell', () => {
    expect(isPlacementValid(boardWith({ 4: 'X1' }), 1, 4)).toBe(false)
  })

  it('rejects placements during movement phase', () => {
    expect(isPlacementValid(emptyBoard(), 6, 0)).toBe(false)
  })
})

describe('isMoveValid / validDestinations', () => {
  const board = boardWith({ 0: 'X1', 1: 'O1', 2: 'X2', 3: 'O2', 4: 'X3', 5: 'O3' })

  it('accepts the expected piece moving to an empty cell, adjacent or not', () => {
    expect(isMoveValid(board, 6, 'X1', 6)).toBe(true)
    expect(isMoveValid(board, 6, 'X1', 8)).toBe(true)
  })

  it('rejects moving the wrong piece', () => {
    expect(isMoveValid(board, 6, 'X2', 6)).toBe(false)
    expect(isMoveValid(board, 7, 'X1', 6)).toBe(false)
  })

  it('rejects moving onto an occupied cell', () => {
    expect(isMoveValid(board, 6, 'X1', 1)).toBe(false)
  })

  it('rejects staying in the same cell', () => {
    expect(isMoveValid(board, 6, 'X1', 0)).toBe(false)
  })

  it('rejects movement during placement phase', () => {
    expect(isMoveValid(boardWith({ 0: 'X1' }), 1, 'X1', 5)).toBe(false)
  })

  it('lists exactly the empty cells for the expected piece', () => {
    expect(validDestinations(board, 6, 'X1')).toEqual([6, 7, 8])
    expect(validDestinations(board, 6, 'O1')).toEqual([])
    expect(validDestinations(board, 3, 'X1')).toEqual([])
  })
})

describe('findWin', () => {
  const rows: CellIndex[][] = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ]
  const cols: CellIndex[][] = [
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
  ]
  const diags: CellIndex[][] = [
    [0, 4, 8],
    [2, 4, 6],
  ]

  it.each(rows)('detects the horizontal win %s-%s-%s', (a, b, c) => {
    const board = boardWith({ [a]: 'X1', [b]: 'X2', [c]: 'X3' })
    expect(findWin(board)).toEqual({ symbol: 'X', line: [a, b, c] })
  })

  it.each(cols)('detects the vertical win %s-%s-%s', (a, b, c) => {
    const board = boardWith({ [a]: 'O1', [b]: 'O2', [c]: 'O3' })
    expect(findWin(board)).toEqual({ symbol: 'O', line: [a, b, c] })
  })

  it.each(diags)('detects the diagonal win %s-%s-%s', (a, b, c) => {
    const board = boardWith({ [a]: 'X3', [b]: 'X1', [c]: 'X2' })
    expect(findWin(board)).toEqual({ symbol: 'X', line: [a, b, c] })
  })

  it('does not report a win for mixed symbols on a line', () => {
    expect(findWin(boardWith({ 0: 'X1', 1: 'O1', 2: 'X2' }))).toBeNull()
  })

  it('does not report a win on an empty or partial board', () => {
    expect(findWin(emptyBoard())).toBeNull()
    expect(findWin(boardWith({ 0: 'X1', 1: 'X2' }))).toBeNull()
    expect(
      findWin(boardWith({ 0: 'X1', 1: 'O1', 2: 'X2', 3: 'O2', 4: 'X3', 5: 'O3' })),
    ).toBeNull()
  })
})
