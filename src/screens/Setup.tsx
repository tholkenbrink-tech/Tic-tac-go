import { useState } from 'react'

interface SetupProps {
  initialP1: string
  initialP2: string
  onBack: () => void
  onContinue: (p1: string, p2: string) => void
}

export function Setup({ initialP1, initialP2, onBack, onContinue }: SetupProps) {
  const [p1, setP1] = useState(initialP1)
  const [p2, setP2] = useState(initialP2)
  const [error, setError] = useState('')

  function submit() {
    const a = p1.trim()
    const b = p2.trim()
    if (!a || !b) {
      setError('Both players need a name.')
      return
    }
    if (a.toLowerCase() === b.toLowerCase()) {
      setError('Choose two different names.')
      return
    }
    onContinue(a, b)
  }

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
        <div className="field">
          <label htmlFor="p1">Player 1</label>
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
            placeholder="e.g. Ada"
          />
        </div>
        <div className="field">
          <label htmlFor="p2">Player 2</label>
          <input
            id="p2"
            value={p2}
            maxLength={16}
            autoComplete="off"
            enterKeyHint="done"
            onChange={(e) => {
              setP2(e.target.value)
              setError('')
            }}
            placeholder="e.g. Grace"
          />
        </div>
        <p className="field-error" role="alert">
          {error}
        </p>
        <p className="hint">
          Player 1 starts as X in round 1. Symbols swap every round. Names lock once the
          match starts.
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
