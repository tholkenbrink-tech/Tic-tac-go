import type { LayoutPref, Prefs } from '../engine/persist.ts'
import type { ClockType, MatchFormat } from '../engine/types.ts'
import { defaultLayout, isTablet, isTouchDevice } from '../lib/device.ts'

function autoLayoutHint(): string {
  if (!isTouchDevice())
    return 'Auto on this device: side-by-side — both panels face the same way for players sharing a screen.'
  if (isTablet())
    return 'Auto on this device: face-to-face — lay it flat between you; the far panel is rotated for the opposite player.'
  return defaultLayout() === 'faceToFace'
    ? 'Auto on this phone: face-to-face when upright, side-by-side when rotated to landscape.'
    : 'Auto on this phone: side-by-side in landscape, face-to-face when upright.'
}

interface ConfigProps {
  prefs: Prefs
  onChange: (patch: Partial<Prefs>) => void
  onBack: () => void
  onStart: () => void
}

const CLOCK_EXPLAIN: Record<ClockType, string> = {
  untimed: 'No clocks — the round runs until someone lines up three or you end it.',
  speed: 'One shared 2:00 countdown — if it hits zero before a win, the round is a draw.',
  duel: 'Chess-style clocks — only the active player’s clock runs, and flagging loses the round.',
}

const FORMATS: { value: MatchFormat; label: string }[] = [
  { value: 'best3', label: 'Best of 3' },
  { value: 'best5', label: 'Best of 5' },
  { value: 'best7', label: 'Best of 7' },
  { value: 'unlimited', label: '∞' },
]

export function Config({ prefs, onChange, onBack, onStart }: ConfigProps) {
  return (
    <main className="screen">
      <h2>Match settings</h2>

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
              onClick={() => onChange({ clockType: value })}
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

        <h3>Turn limit</h3>
        <div className="seg" role="group" aria-label="Turn limit">
          {(
            [
              [null, 'None'],
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

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Table layout</h3>
        <div className="seg" role="group" aria-label="Table layout">
          {(
            [
              ['auto', 'Auto'],
              ['faceToFace', 'Face-to-face'],
              ['sideBySide', 'Side-by-side'],
            ] as [LayoutPref, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={prefs.layout === value}
              onClick={() => onChange({ layout: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="hint">
          {prefs.layout === 'auto' && autoLayoutHint()}
          {prefs.layout === 'faceToFace' &&
            'Device lies flat between you; the far panel is rotated for the opposite player.'}
          {prefs.layout === 'sideBySide' &&
            'Both panels face the same way — for players sitting next to each other.'}
        </p>
      </div>

      <div className="card">
        <div className="toggle-row">
          <span style={{ fontWeight: 700 }}>Sound effects</span>
          <button
            type="button"
            role="switch"
            className="switch"
            aria-checked={prefs.sound}
            aria-label="Sound effects"
            onClick={() => onChange({ sound: !prefs.sound })}
          />
        </div>
        <div className="toggle-row">
          <span style={{ fontWeight: 700 }}>Haptic feedback</span>
          <button
            type="button"
            role="switch"
            className="switch"
            aria-checked={prefs.haptics}
            aria-label="Haptic feedback"
            onClick={() => onChange({ haptics: !prefs.haptics })}
          />
        </div>
      </div>

      <button type="button" className="btn btn--primary" onClick={onStart}>
        Start match
      </button>
      <button type="button" className="btn btn--ghost" onClick={onBack}>
        Back
      </button>
    </main>
  )
}
