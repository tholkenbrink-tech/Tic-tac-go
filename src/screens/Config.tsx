import type { Prefs } from '../engine/persist.ts'
import type { ClockType, MatchFormat } from '../engine/types.ts'

interface ConfigProps {
  prefs: Prefs
  onChange: (patch: Partial<Prefs>) => void
  onBack: () => void
  onStart: () => void
  onOpenSettings: () => void
}

const CLOCK_EXPLAIN: Record<ClockType, string> = {
  untimed: 'No clocks at all — the round runs until someone lines up three or you end it.',
  speed: 'A countdown for every turn — run out of time on your move and you lose the round.',
  duel: 'Chess-style clocks — only the active player’s clock runs, and flagging loses the round.',
}

const FORMATS: { value: MatchFormat; label: string }[] = [
  { value: 'best3', label: 'Best of 3' },
  { value: 'best5', label: 'Best of 5' },
  { value: 'best7', label: 'Best of 7' },
  { value: 'unlimited', label: '∞' },
]

export function Config({ prefs, onChange, onBack, onStart, onOpenSettings }: ConfigProps) {
  return (
    <main className="screen screen--config">
      <div className="screen-head">
        <h2>Match settings</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="Settings"
          onClick={onOpenSettings}
        >
          ⚙
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Clock</h3>
        <div className="seg" role="group" aria-label="Clock type">
          {(
            [
              ['untimed', 'Untimed'],
              ['speed', 'Speed round'],
              ['duel', 'Duel clock'],
            ] as [ClockType, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={prefs.clockType === value}
              onClick={() =>
                onChange({
                  clockType: value,
                  // Speed round IS a turn limit — make sure one is selected.
                  ...(value === 'speed' && prefs.turnLimitMs === null
                    ? { turnLimitMs: 10_000 }
                    : {}),
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <p className="hint">{CLOCK_EXPLAIN[prefs.clockType]}</p>

        {prefs.clockType === 'duel' && (
          <>
            <h3>Time per player</h3>
            <div className="seg" role="group" aria-label="Duel clock starting time">
              {[60_000, 120_000, 180_000].map((ms) => (
                <button
                  key={ms}
                  type="button"
                  aria-pressed={prefs.duelMs === ms}
                  onClick={() => onChange({ duelMs: ms })}
                >
                  {ms / 60_000} min
                </button>
              ))}
            </div>
          </>
        )}

        {prefs.clockType !== 'untimed' && (
          <>
            <h3>{prefs.clockType === 'speed' ? 'Time per turn' : 'Turn limit'}</h3>
            <div className="seg" role="group" aria-label="Turn limit">
              {(
                [
                  ...(prefs.clockType === 'duel' ? [[null, 'None']] : []),
                  [10_000, '10s'],
                  [20_000, '20s'],
                  [30_000, '30s'],
                ] as [number | null, string][]
              ).map(([ms, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={prefs.turnLimitMs === ms}
                  onClick={() => onChange({ turnLimitMs: ms })}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="hint">
              {prefs.turnLimitMs === null
                ? 'Take as long as you like per turn.'
                : 'Run out of turn time and your opponent takes the round.'}
            </p>
          </>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Match format</h3>
        <div className="seg" role="group" aria-label="Match format">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={prefs.format === f.value}
              onClick={() => onChange({ format: f.value })}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="hint">
          {prefs.format === 'unlimited'
            ? 'Play on until you decide to stop.'
            : `First to ${{ best3: 2, best5: 3, best7: 4 }[prefs.format]} round wins takes the match.`}
        </p>
      </div>

      <div className="start-bar">
        <button type="button" className="btn btn--primary" onClick={onStart}>
          Start match
        </button>
      </div>
      <button type="button" className="btn btn--ghost" onClick={onBack}>
        Back
      </button>
    </main>
  )
}
