import { useEffect, useRef, useState } from 'react'
import { expectedPiece, pieceCell, symbolOf, validDestinations } from '../engine/rules.ts'
import type { CellIndex, MatchState, PieceId } from '../engine/types.ts'
import { PIECE_ORDER } from '../engine/types.ts'
import { PieceGlyph } from './PieceGlyph.tsx'

interface BoardProps {
  state: MatchState
  onCellTap: (cell: CellIndex) => void
  onPieceTap: (piece: PieceId) => void
  /** True while no overlay is open, enabling arrow-key/Enter play. */
  keyboardEnabled: boolean
  onEscape: () => void
}

/** Centers of each cell in the 0..100 SVG space for the win-line overlay. */
function cellCenter(cell: CellIndex): { x: number; y: number } {
  const col = cell % 3
  const row = Math.floor(cell / 3)
  return { x: col * 33.4 + 16.7, y: row * 33.4 + 16.7 }
}

export function Board({ state, onCellTap, onPieceTap, keyboardEnabled, onEscape }: BoardProps) {
  const interactive =
    state.status === 'playing' &&
    !state.paused &&
    state.roundResult === null &&
    state.undoRequest === null
  const active = interactive ? expectedPiece(state.turn) : null
  const targets = new Set<CellIndex>(
    interactive && state.phase === 'movement' && state.selected
      ? validDestinations(state.board, state.turn, state.selected)
      : [],
  )
  const winLine = state.roundResult?.kind === 'win' ? state.roundResult.line : null
  const winSymbol = state.roundResult?.kind === 'win' ? state.roundResult.winnerSymbol : null

  // Double-tap protection lives in the reducer: a repeated tap is an invalid
  // action (occupied cell, no selection, wrong piece) and is ignored, while
  // round transitions disable every cell below.

  // Keyboard play: arrow keys move a cursor over the grid, Enter/Space act on
  // the focused cell, Escape cancels a selection. The cursor only becomes
  // visible once a key is used, so touch players never see it.
  const [cursor, setCursor] = useState<CellIndex>(4)
  const [kbActive, setKbActive] = useState(false)
  const stateRef = useRef({ state, interactive, keyboardEnabled })
  stateRef.current = { state, interactive, keyboardEnabled }
  const actionsRef = useRef({ onCellTap, onPieceTap, onEscape })
  actionsRef.current = { onCellTap, onPieceTap, onEscape }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const { state: s, interactive: canPlay, keyboardEnabled: kb } = stateRef.current
      if (!kb) return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if (e.key === 'Escape') {
        if (s.selected) {
          e.preventDefault()
          actionsRef.current.onEscape()
        }
        return
      }
      if (!canPlay) return

      const moves: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      }
      const delta = moves[e.key]
      if (delta) {
        e.preventDefault()
        setKbActive(true)
        setCursor((prev) => {
          const col = Math.min(2, Math.max(0, (prev % 3) + delta[0]))
          const row = Math.min(2, Math.max(0, Math.floor(prev / 3) + delta[1]))
          return (row * 3 + col) as CellIndex
        })
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setKbActive(true)
        setCursor((prev) => {
          const occupant = s.board[prev] ?? null
          const activePiece = expectedPiece(s.turn)
          if (occupant !== null && occupant === activePiece) {
            actionsRef.current.onPieceTap(occupant)
          } else {
            actionsRef.current.onCellTap(prev)
          }
          return prev
        })
      }
    }
    function onPointerDown() {
      setKbActive(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  // Track newly placed pieces for the pop-in animation.
  const [entered, setEntered] = useState<Set<PieceId>>(new Set())
  const onBoard = PIECE_ORDER.filter((p) => pieceCell(state.board, p) !== null)
  useEffect(() => {
    setEntered((prev) => {
      const next = new Set(prev)
      for (const p of onBoard) next.add(p)
      for (const p of PIECE_ORDER) if (!onBoard.includes(p)) next.delete(p)
      return next.size === prev.size && [...next].every((p) => prev.has(p)) ? prev : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.board])

  return (
    <div className="board-wrap">
      <div className="board" role="group" aria-label="Game board">
        <div className="board-grid">
          {Array.from({ length: 9 }, (_, i) => {
            const cell = i as CellIndex
            const occupant = state.board[cell] ?? null
            const isTarget = targets.has(cell)
            const isActivePieceHere = occupant !== null && occupant === active
            let label: string
            let enabled = false
            if (!interactive) {
              label = occupant ? `Cell ${cell + 1}, ${occupant}` : `Cell ${cell + 1}, empty`
            } else if (state.phase === 'placement') {
              enabled = occupant === null
              label = occupant
                ? `Cell ${cell + 1}, occupied by ${occupant}`
                : `Place ${active ?? ''} on cell ${cell + 1}`
            } else if (isActivePieceHere) {
              enabled = true
              label = state.selected
                ? `Cancel selection of ${occupant}`
                : `Select ${occupant} to move`
            } else if (isTarget) {
              enabled = true
              label = `Move ${state.selected ?? ''} to cell ${cell + 1}`
            } else {
              label = occupant
                ? `Cell ${cell + 1}, occupied by ${occupant}`
                : `Cell ${cell + 1}, empty`
            }

            const isCursor = kbActive && interactive && cursor === cell
            return (
              <button
                key={cell}
                type="button"
                className={`cell${isTarget ? ' cell--target' : ''}${isCursor ? ' cell--cursor' : ''}`}
                disabled={!enabled}
                aria-label={label}
                onClick={() => {
                  if (isActivePieceHere && occupant) onPieceTap(occupant)
                  else onCellTap(cell)
                }}
              />
            )
          })}
        </div>

        <div className="pieces">
          {onBoard.map((piece) => {
            const cell = pieceCell(state.board, piece)
            if (cell === null) return null
            const col = cell % 3
            const row = Math.floor(cell / 3)
            const sym = symbolOf(piece)
            const isActive = piece === active
            const isSelected = piece === state.selected
            const isWinner = winLine?.includes(cell) ?? false
            const num = piece[1]
            return (
              <div
                key={piece}
                className={[
                  'piece',
                  `piece--${sym.toLowerCase()}`,
                  isActive ? 'piece--active' : '',
                  isSelected ? 'piece--selected' : '',
                  isWinner ? 'piece--winner' : '',
                  entered.has(piece) ? '' : 'piece--enter',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  transform: `translate(calc(${col} * (100% + 6px)), calc(${row} * (100% + 6px)))`,
                }}
              >
                <div className="piece-inner">
                  <PieceGlyph symbol={sym} />
                  <span className="piece-num piece-num--p1" aria-hidden>
                    {num}
                  </span>
                  <span className="piece-num piece-num--p2" aria-hidden>
                    {num}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {winLine && winSymbol && (
          <svg
            className={`win-line win-line--${winSymbol.toLowerCase()}`}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <line
              x1={cellCenter(winLine[0] as CellIndex).x}
              y1={cellCenter(winLine[0] as CellIndex).y}
              x2={cellCenter(winLine[2] as CellIndex).x}
              y2={cellCenter(winLine[2] as CellIndex).y}
            />
          </svg>
        )}
      </div>
    </div>
  )
}
