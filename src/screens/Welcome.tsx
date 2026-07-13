import { PieceGlyph } from '../components/PieceGlyph.tsx'

interface WelcomeProps {
  savedNames: { p1: string; p2: string } | null
  onNewMatch: () => void
  onQuickPlay: () => void
  onHowToPlay: () => void
  onOpenSettings: () => void
}

export function Welcome({
  savedNames,
  onNewMatch,
  onQuickPlay,
  onHowToPlay,
  onOpenSettings,
}: WelcomeProps) {
  return (
    <main className="screen screen--center">
      <button
        type="button"
        className="icon-btn icon-btn--corner"
        aria-label="Settings"
        onClick={onOpenSettings}
      >
        ⚙
      </button>
      <div className="brand">
        <div className="brand-logo" aria-hidden>
          <PieceGlyph symbol="X" size="56px" />
          <PieceGlyph symbol="O" size="56px" />
        </div>
        <h1 className="brand-title">
          Speed <span className="tx">Tic</span> <span className="to">Tac</span> Toe
        </h1>
        <p className="brand-sub">
          Three pieces each, one board between you. Place them, then keep them moving —
          first line wins. Fast, face to face, on one phone.
        </p>
      </div>

      <div className="stack">
        <button type="button" className="btn btn--primary" onClick={onNewMatch}>
          New match
        </button>
        {savedNames && (
          <button type="button" className="btn" onClick={onQuickPlay}>
            Quick play — {savedNames.p1} vs {savedNames.p2}
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onHowToPlay}>
          How to play
        </button>
      </div>
    </main>
  )
}
