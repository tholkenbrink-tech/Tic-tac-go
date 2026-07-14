import { useState } from 'react'
import { AI_LEVELS, aiDisplayName, type AiLevel } from '../engine/ai.ts'

interface SetupProps {
  initialP1: string
  initialP2: string
  initialP2Kind: 'human' | 'computer'
  initialAiLevel: AiLevel
  onBack: () => void
  onContinue: (
    p1: string,
    p2: string,
    opponent: { kind: 'human' } | { kind: 'computer'; level: AiLevel },
  ) => void
}

export function Setup({
  initialP1,
  initialP2,
  initialP2Kind,
  initialAiLevel,
  onBack,
  onContinue,
}: SetupProps) {
  const [p1, setP1] = useState(initialP1)
  const [p2, setP2] = useState(initialP2)
  const [p2Kind, setP2Kind] = useState<'human' | 'computer'>(initialP2Kind)
  const [aiLevel, setAiLevel] = useState<AiLevel>(initialAiLevel)
  const [error, setError] = useState('')

  function submit() {
    // Empty fields fall back to defaults, so this step can simply be skipped.
    const a = p1.trim() || 'Player 1'
    if (p2Kind === 'computer') {
      onContinue(a, aiDisplayName(aiLevel), { kind: 'computer', level: aiLevel })
      return
    }
    const b = p2.trim() || 'Player 2'
    if (a.toLowerCase() === b.toLowerCase()) {
      setError('Choose two different names.')
      return
    }
    onContinue(a, b, { kind: 'human' })
  }

  const levelMeta = AI_LEVELS.find((l) => l.value === aiLevel)

  return (
    <main className="screen">
      <h2>Who&apos;s playing?</h2>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="field tint-p1">
          <label htmlFor="p1">Player 1 · cyan</label>
          <input
            id="p1"
            value={p1}
            maxLength={16}
            autoComplete="off"
            enterKeyHint="next"
            onChange={(e) => {
              setP1(e.target.value)
              setError('')
            }}
            placeholder="Player 1"
          />
        </div>

        <div className="field tint-p2">
          <label htmlFor="p2">Player 2 · coral</label>
          {p2Kind === 'human' ? (
            <input
              id="p2"
              aria-label="Player 2 name"
              value={p2}
              maxLength={16}
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => {
                setP2(e.target.value)
                setError('')
              }}
              placeholder="Player 2"
            />
          ) : (
            <>
              <div className="seg" role="group" aria-label="Computer strength">
                {AI_LEVELS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    aria-pressed={aiLevel === l.value}
                    onClick={() => setAiLevel(l.value)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <p className="hint">
                {levelMeta?.label} plays at roughly the level of a {levelMeta?.elo} chess
                player: {aiLevel === 'beginner' && 'it often misses wins and blocks.'}
                {aiLevel === 'medium' &&
                  'it takes wins and blocks threats, with the occasional lapse.'}
                {aiLevel === 'hard' &&
                  'it never slips and spots forks, but deep traps still work.'}
                {aiLevel === 'pro' && 'it searches deeply and rarely makes a mistake.'}
              </p>
            </>
          )}
          {/* Quiet opt-in: human vs human is the default experience. */}
          <label className="check">
            <input
              type="checkbox"
              checked={p2Kind === 'computer'}
              onChange={(e) => {
                setP2Kind(e.target.checked ? 'computer' : 'human')
                setError('')
              }}
            />
            <span>Play against the computer</span>
          </label>
        </div>

        <p className="field-error" role="alert">
          {error}
        </p>
        <p className="hint">
          {p2Kind === 'human'
            ? 'Leave a field empty to just play as “Player 1” / “Player 2”. Your color stays yours for the whole match; X and O swap between rounds, and X always starts.'
            : 'You are cyan, the computer is coral. X and O swap between rounds, X always starts — the computer moves on its own, quickly but readably.'}
        </p>
        <button type="submit" className="btn btn--primary">
          Continue
        </button>
      </form>
      <button type="button" className="btn btn--ghost" onClick={onBack}>
        Back
      </button>
    </main>
  )
}
