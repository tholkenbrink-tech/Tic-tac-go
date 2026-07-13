import { useRef, useState } from 'react'
import { PieceGlyph } from '../components/PieceGlyph.tsx'
import type { Symbol_ } from '../engine/types.ts'

interface TutorialProps {
  onDone: () => void
}

function MiniPiece({ symbol, num, dim = false }: { symbol: Symbol_; num?: number; dim?: boolean }) {
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        opacity: dim ? 0.35 : 1,
      }}
    >
      <PieceGlyph symbol={symbol} size="60%" />
      {num !== undefined && <span className="tut-label" style={{ color: symbol === 'X' ? 'var(--x)' : 'var(--o)' }}>{num}</span>}
    </span>
  )
}

interface StepBoard {
  cells: ({ symbol: Symbol_; num: number; dim?: boolean } | null)[]
  highlight?: number[]
}

const STEPS: { title: string; body: string; board: StepBoard }[] = [
  {
    title: 'Three pieces each',
    body: 'Each player has exactly three numbered pieces: X1 X2 X3 and O1 O2 O3. Nothing else ever enters the board.',
    board: {
      cells: [
        { symbol: 'X', num: 1 },
        { symbol: 'X', num: 2 },
        { symbol: 'X', num: 3 },
        null,
        null,
        null,
        { symbol: 'O', num: 1 },
        { symbol: 'O', num: 2 },
        { symbol: 'O', num: 3 },
      ],
    },
  },
  {
    title: 'Place in strict order',
    body: 'Take turns placing on empty cells, starter first: piece 1, then 1, 2, 2, 3, 3. X starts round 1 — the starting player alternates each round.',
    board: {
      cells: [
        { symbol: 'X', num: 1 },
        { symbol: 'O', num: 1 },
        null,
        { symbol: 'X', num: 2 },
        { symbol: 'O', num: 2 },
        null,
        { symbol: 'X', num: 3, dim: true },
        null,
        null,
      ],
      highlight: [6],
    },
  },
  {
    title: 'Then keep moving',
    body: 'Once all six are down, the same order repeats — but now each piece moves to any empty cell. Tap the glowing piece, then tap its destination.',
    board: {
      cells: [
        { symbol: 'X', num: 1 },
        { symbol: 'O', num: 1 },
        { symbol: 'X', num: 2 },
        { symbol: 'O', num: 2 },
        { symbol: 'X', num: 3 },
        { symbol: 'O', num: 3 },
        null,
        null,
        null,
      ],
      highlight: [6, 7, 8],
    },
  },
  {
    title: 'Line up three to win',
    body: 'Any horizontal, vertical, or diagonal line of your three pieces wins the round — whether you placed or moved into it.',
    board: {
      cells: [
        { symbol: 'X', num: 1 },
        { symbol: 'O', num: 1 },
        { symbol: 'O', num: 2 },
        null,
        { symbol: 'X', num: 2 },
        { symbol: 'O', num: 3 },
        null,
        null,
        { symbol: 'X', num: 3 },
      ],
      highlight: [0, 4, 8],
    },
  },
]

export function Tutorial({ onDone }: TutorialProps) {
  const [step, setStep] = useState(0)
  const touchX = useRef<number | null>(null)
  const current = STEPS[step]
  if (!current) return null
  const last = step === STEPS.length - 1

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="How to play">
      <div
        className="overlay-card"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchX.current
          touchX.current = null
          const end = e.changedTouches[0]?.clientX
          if (start == null || end == null) return
          const dx = end - start
          if (dx < -40 && !last) setStep((s) => s + 1)
          if (dx > 40 && step > 0) setStep((s) => s - 1)
        }}
      >
        <h2>{current.title}</h2>
        <div className="tut-board" aria-hidden>
          {current.board.cells.map((cell, i) => (
            <span
              key={i}
              className={`tut-cell${current.board.highlight?.includes(i) ? ' tut-cell--hl' : ''}`}
            >
              {cell && <MiniPiece symbol={cell.symbol} num={cell.num} dim={cell.dim ?? false} />}
            </span>
          ))}
        </div>
        <p className="hint" style={{ fontSize: 16, minHeight: 72 }}>
          {current.body}
        </p>
        <div className="tut-dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <i key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>
        <div className="row">
          {step > 0 ? (
            <button type="button" className="btn btn--ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={onDone}>
              Skip
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => (last ? onDone() : setStep(step + 1))}
          >
            {last ? "Let's play" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
