import { useEffect, useRef, useState } from 'react'
import { Board } from '../components/Board.tsx'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { ControlIcon } from '../components/ControlIcon.tsx'
import { PlayerPanel } from '../components/PlayerPanel.tsx'
import { Tutorial } from './Tutorial.tsx'
import { activeSymbol, canRequestUndo, symbolForPlayer } from '../engine/reducer.ts'
import { MAX_UNDOS_PER_ROUND } from '../engine/types.ts'
import type {
  CellIndex,
  MatchAction,
  MatchState,
  PieceId,
  RoundResult,
} from '../engine/types.ts'
import type { LayoutMode } from '../lib/device.ts'

interface GameScreenProps {
  state: MatchState
  now: number
  layout: LayoutMode
  dispatch: (action: MatchAction) => void
  onToggleLayout: () => void
  onExitToMenu: () => void
  onRematch: () => void
  onNewMatch: () => void
}

type Confirm = 'endRound' | 'endMatch' | 'exit' | null

const REASON_TEXT: Record<Exclude<RoundResult['reason'], never>, string> = {
  line: 'Three in a row',
  turnTimeout: 'Turn time expired',
  duelTimeout: 'Duel clock expired',
  manual: 'Round ended manually',
}

const CONFETTI_PARTICLE_COUNT = 60

function clockRules(state: MatchState): { k: string; v: string }[] {
  const c = state.config.clock
  const rules: { k: string; v: string }[] = []
  if (c.type === 'untimed') rules.push({ k: 'Clock', v: 'Untimed' })
  if (c.type === 'speed')
    rules.push({
      k: 'Clock',
      v: `Speed round · ${(c.turnLimitMs ?? 0) / 1000}s per turn`,
    })
  if (c.type === 'duel') {
    rules.push({ k: 'Clock', v: `Duel · ${c.duelMs / 60_000} min each` })
    rules.push({
      k: 'Turn limit',
      v: c.turnLimitMs === null ? 'None' : `${c.turnLimitMs / 1000}s per turn`,
    })
  }
  rules.push({
    k: 'Format',
    v: state.winsNeeded === null ? 'Unlimited' : `First to ${state.winsNeeded} wins`,
  })
  return rules
}

function Confetti() {
  const pieces = Array.from({ length: CONFETTI_PARTICLE_COUNT }, (_, i) => {
    const left = (i * 61) % 100
    const delay = ((i * 37) % 100) / 90
    const duration = 2.4 + ((i * 13) % 10) / 8
    const colors = ['var(--x)', 'var(--o)', '#4ade80', '#e8eefb', '#a78bfa']
    return (
      <span
        key={i}
        style={{
          left: `${left}%`,
          background: colors[i % colors.length],
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
        }}
      />
    )
  })
  return (
    <div className="confetti" aria-hidden>
      {pieces}
    </div>
  )
}

export function GameScreen({
  state,
  now,
  layout,
  dispatch,
  onToggleLayout,
  onExitToMenu,
  onRematch,
  onNewMatch,
}: GameScreenProps) {
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [resultVisible, setResultVisible] = useState(false)
  const menuPausedRef = useRef(false)

  // Let the winning-line animation play before the result card covers it.
  useEffect(() => {
    if (state.status === 'roundComplete' || state.status === 'matchComplete') {
      const lineWin = state.roundResult?.kind === 'win' && state.roundResult.reason === 'line'
      const t = setTimeout(() => setResultVisible(true), lineWin ? 1100 : 400)
      return () => clearTimeout(t)
    }
    setResultVisible(false)
    return undefined
  }, [state.status, state.roundResult])

  const playing = state.status === 'playing'

  function pauseForUi() {
    if (playing && !state.paused) {
      menuPausedRef.current = true
      dispatch({ type: 'PAUSE', now: Date.now() })
    }
  }

  function resumeFromUi() {
    if (menuPausedRef.current && state.status === 'playing') {
      menuPausedRef.current = false
      dispatch({ type: 'RESUME', now: Date.now() })
    }
  }

  function openMenu() {
    pauseForUi()
    setMenuOpen(true)
  }

  function closeMenu(resume: boolean) {
    setMenuOpen(false)
    setConfirm(null)
    if (resume) resumeFromUi()
    else menuPausedRef.current = false
  }

  const p1Sym = symbolForPlayer(state, 'p1')
  const p2Sym = symbolForPlayer(state, 'p2')

  const confirmProps = {
    endRound: {
      title: 'End this round with no score?',
      message:
        'The round is abandoned — no point for anyone. Symbols still swap for the next round.',
      confirmLabel: 'End round',
      action: () => {
        dispatch({ type: 'END_ROUND_MANUAL', now: Date.now() })
        closeMenu(false)
      },
    },
    endMatch: {
      title: 'End the whole match?',
      message: 'The match finishes now with the current score.',
      confirmLabel: 'End match',
      action: () => {
        dispatch({ type: 'END_MATCH' })
        closeMenu(false)
      },
    },
    exit: {
      title: 'Return to menu?',
      message: 'The match is abandoned and its progress is discarded.',
      confirmLabel: 'Leave match',
      action: () => {
        closeMenu(false)
        onExitToMenu()
      },
    },
  } as const

  function winnerName(result: RoundResult): string | null {
    return result.kind === 'win' ? state.players[result.winner] : null
  }

  const nextXPlayer = state.p1Symbol === 'X' ? 'p2' : 'p1'

  const undosLeft = MAX_UNDOS_PER_ROUND - state.undosUsed
  const overlayOpen = menuOpen || rulesOpen || confirm !== null
  // During the computer's turn the human must not act for it.
  const aiTurn =
    state.ai !== null &&
    state.status === 'playing' &&
    activeSymbol(state) === symbolForPlayer(state, 'p2')

  const roundInfo =
    state.winsNeeded !== null
      ? `Round ${state.roundNumber} · first to ${state.winsNeeded}`
      : `Round ${state.roundNumber}`

  return (
    <div className={`game game--${layout === 'sideBySide' ? 'side' : 'face'}`}>
      {/* Match meta shown once, unrotated — deliberately not duplicated for
          the opposite player in face-to-face play. */}
      <div className="game-meta">{roundInfo}</div>

      <PlayerPanel state={state} viewer="p2" now={now} />

      <div className="game-mid">
        <Board
          state={state}
          keyboardEnabled={!overlayOpen}
          inputLocked={aiTurn}
          onEscape={() => dispatch({ type: 'DESELECT' })}
          onCellTap={(cell: CellIndex) => {
            if (state.phase === 'placement') dispatch({ type: 'PLACE', cell, now: Date.now() })
            else if (state.selected) dispatch({ type: 'MOVE', cell, now: Date.now() })
          }}
          onPieceTap={(piece: PieceId) => {
            if (state.selected === piece) dispatch({ type: 'DESELECT' })
            else dispatch({ type: 'SELECT', piece })
          }}
        />

        {/* Pause overlay covers only the board so the controls row (Menu,
            Resume) stays reachable — ending a paused game must not require
            resuming it first. */}
        {playing && state.paused && !menuOpen && !rulesOpen && confirm === null && (
          <div
            className="overlay overlay--board"
            role="dialog"
            aria-modal="false"
            aria-label="Game paused"
          >
            <div className="overlay-card overlay-card--compact">
              {layout === 'faceToFace' && (
                <p className="pause-flag flip" aria-hidden>
                  <ControlIcon type="pause" size="1.2em" /> Paused
                </p>
              )}
              <button
                type="button"
                className="btn btn--primary"
                style={{ minHeight: 64 }}
                onClick={() => {
                  menuPausedRef.current = false
                  dispatch({ type: 'RESUME', now: Date.now() })
                }}
              >
                <ControlIcon type="resume" size="1.2em" /> Resume
              </button>
              <p className="pause-flag"><ControlIcon type="pause" size="1.2em" /> Paused</p>
            </div>
          </div>
        )}
      </div>

      <div className="controls">
        {playing && (
          <button
            type="button"
            className="ctl"
            onClick={() => {
              if (state.paused) {
                menuPausedRef.current = false
                dispatch({ type: 'RESUME', now: Date.now() })
              } else {
                dispatch({ type: 'PAUSE', now: Date.now() })
              }
            }}
          >
            {state.paused ? (
              <>
                <ControlIcon type="resume" size="1em" /> Resume
              </>
            ) : (
              <>
                <ControlIcon type="pause" size="1em" /> Pause
              </>
            )}
          </button>
        )}
        {playing && (
          <button
            type="button"
            className="ctl"
            disabled={!canRequestUndo(state)}
            aria-label={`Undo last move, ${undosLeft} of ${MAX_UNDOS_PER_ROUND} left this round`}
            onClick={() => dispatch({ type: 'REQUEST_UNDO', now: Date.now() })}
          >
            <ControlIcon type="undo" size="1em" /> Undo ({undosLeft})
          </button>
        )}
        <button
          type="button"
          className="ctl ctl--icon"
          aria-label="Show rules"
          onClick={() => {
            pauseForUi()
            setRulesOpen(true)
          }}
        >
          <ControlIcon type="help" size="1.1em" />
        </button>
        <button type="button" className="ctl" onClick={openMenu}>
          <ControlIcon type="menu" size="1em" /> Menu
        </button>
      </div>

      <PlayerPanel state={state} viewer="p1" now={now} />

      {/* Ready overlay */}
      {state.status === 'ready' && !menuOpen && !rulesOpen && confirm === null && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Round ready">
          <div className="overlay-card">
            <p className="panel-round" style={{ fontSize: 14 }}>
              Round {state.roundNumber}
              {state.winsNeeded !== null && ` · first to ${state.winsNeeded}`}
            </p>
            <div className="ready-vs">
              <span className="tint-p1">
                <span className="pc-text">{state.players.p1}</span>{' '}
                <span className="sym">{p1Sym}</span>
              </span>
              <span className="vs">VS</span>
              <span className="tint-p2">
                <span className="sym">{p2Sym}</span>{' '}
                <span className="pc-text">{state.players.p2}</span>
              </span>
            </div>
            <div className="result-score" aria-label="Score">
              <span className="num">{state.scores.p1}</span>
              <span style={{ color: 'var(--text-dim)' }}>–</span>
              <span className="num">{state.scores.p2}</span>
            </div>
            <div>
              {clockRules(state).map((r) => (
                <div key={r.k} className="rule-line">
                  <span className="k">{r.k}</span>
                  <span className="v">{r.v}</span>
                </div>
              ))}
            </div>
            <p className="assign-note">
              {state.players[state.p1Symbol === 'X' ? 'p1' : 'p2']} plays X and starts.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => dispatch({ type: 'START_ROUND', now: Date.now() })}
            >
              Start round
            </button>
            <div className="row">
              <button type="button" className="ctl" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setRulesOpen(true)}>
                Rules
              </button>
              <button
                type="button"
                className="ctl"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setConfirm('exit')}
              >
                Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo approval — both players must agree; clocks are already stopped. */}
      {playing && state.undoRequest && !menuOpen && !rulesOpen && confirm === null && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Undo approval">
          <div className="overlay-card">
            {state.ai ? (
              <p className="hint" style={{ textAlign: 'center' }}>
                {state.undoRequest.approvals.p2
                  ? `✓ ${state.players.p2} approved`
                  : `${state.players.p2} approves automatically…`}
              </p>
            ) : (
              <div className={layout === 'faceToFace' ? 'flip' : ''}>
                <button
                  type="button"
                  className={`btn undo-approve${state.undoRequest.approvals.p2 ? ' undo-approve--done' : ''}`}
                  disabled={state.undoRequest.approvals.p2}
                  onClick={() => dispatch({ type: 'APPROVE_UNDO', player: 'p2', now: Date.now() })}
                >
                  {state.undoRequest.approvals.p2
                    ? `✓ ${state.players.p2} approved`
                    : `${state.players.p2}: approve undo`}
                </button>
              </div>
            )}
            <h2>↶ Undo last move?</h2>
            <p className="hint" style={{ fontSize: 15 }}>
              Both players must approve. {undosLeft} of {MAX_UNDOS_PER_ROUND} undos left this
              round. Clocks are stopped while you decide.
            </p>
            <button
              type="button"
              className={`btn undo-approve${state.undoRequest.approvals.p1 ? ' undo-approve--done' : ''}`}
              disabled={state.undoRequest.approvals.p1}
              onClick={() => dispatch({ type: 'APPROVE_UNDO', player: 'p1', now: Date.now() })}
            >
              {state.undoRequest.approvals.p1
                ? `✓ ${state.players.p1} approved`
                : `${state.players.p1}: approve undo`}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => dispatch({ type: 'CANCEL_UNDO', now: Date.now() })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Menu sheet */}
      {menuOpen && confirm === null && !rulesOpen && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Game menu">
          <div className="overlay-card">
            <h2>Menu</h2>
            <div className="stack">
              <button type="button" className="btn btn--primary" onClick={() => closeMenu(true)}>
                Back to game
              </button>

              <div>
                <p className="menu-label">Table layout</p>
                <div className="seg" role="group" aria-label="Table layout">
                  <button
                    type="button"
                    aria-pressed={layout === 'faceToFace'}
                    onClick={() => layout !== 'faceToFace' && onToggleLayout()}
                  >
                    Face-to-face
                  </button>
                  <button
                    type="button"
                    aria-pressed={layout === 'sideBySide'}
                    onClick={() => layout !== 'sideBySide' && onToggleLayout()}
                  >
                    Side-by-side
                  </button>
                </div>
                <p className="hint">
                  {layout === 'faceToFace'
                    ? 'The device lies flat between you; the far panel is rotated for the opposite player.'
                    : 'Both panels face the same way, for players sitting side by side.'}
                </p>
              </div>

              {playing && (
                <button type="button" className="btn" onClick={() => setConfirm('endRound')}>
                  End round (no score)
                </button>
              )}
              {state.status !== 'matchComplete' && (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => setConfirm('endMatch')}
                >
                  End match
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rules overlay (tutorial) */}
      {rulesOpen && (
        <Tutorial
          onDone={() => {
            setRulesOpen(false)
            if (!menuOpen) resumeFromUi()
          }}
        />
      )}

      {/* Round result */}
      {state.status === 'roundComplete' && state.roundResult && resultVisible && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Round result">
          <div className="overlay-card">
            {state.roundResult.kind === 'win' ? (
              <>
                <p
                  className={`result-headline result-headline--pc tint-${state.roundResult.winner}`}
                >
                  {winnerName(state.roundResult)} wins the round!
                </p>
                <p className="result-reason">
                  Playing {state.roundResult.winnerSymbol} · {REASON_TEXT[state.roundResult.reason]}
                </p>
              </>
            ) : (
              <>
                <p className="result-headline">Round drawn</p>
                <p className="result-reason">{REASON_TEXT[state.roundResult.reason]}</p>
              </>
            )}
            <div className="result-score" aria-label="Score">
              <span style={{ fontSize: 15 }}>{state.players.p1}</span>
              <span className="num">{state.scores.p1}</span>
              <span style={{ color: 'var(--text-dim)' }}>–</span>
              <span className="num">{state.scores.p2}</span>
              <span style={{ fontSize: 15 }}>{state.players.p2}</span>
            </div>
            <p className="assign-note">
              Next round: {state.players[nextXPlayer]} plays X and starts
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => dispatch({ type: 'NEXT_ROUND' })}
            >
              Start round {state.roundNumber + 1}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirm('endMatch')}>
              End match
            </button>
          </div>
        </div>
      )}

      {/* Match result */}
      {state.status === 'matchComplete' && state.matchResult && resultVisible && (
        <>
          {state.matchResult.winner && <Confetti />}
          <div className="overlay" role="dialog" aria-modal="true" aria-label="Match result">
            <div className="overlay-card">
              {state.matchResult.winner ? (
                <>
                  <p className="panel-round" style={{ fontSize: 13 }}>
                    🏆 Match winner
                  </p>
                  <p
                    className={`result-headline result-headline--pc tint-${state.matchResult.winner}`}
                  >
                    {state.players[state.matchResult.winner]}
                  </p>
                </>
              ) : (
                <p className="result-headline">Match ended level</p>
              )}
              <div className="result-score" aria-label="Final score">
                <span style={{ fontSize: 15 }}>{state.players.p1}</span>
                <span className="num">{state.matchResult.scores.p1}</span>
                <span style={{ color: 'var(--text-dim)' }}>–</span>
                <span className="num">{state.matchResult.scores.p2}</span>
                <span style={{ fontSize: 15 }}>{state.players.p2}</span>
              </div>
              <p className="result-reason">
                {state.matchResult.roundsPlayed}{' '}
                {state.matchResult.roundsPlayed === 1 ? 'round' : 'rounds'} played
                {state.matchResult.endedManually ? ' · ended manually' : ''}
              </p>
              <div className="stack">
                <button type="button" className="btn btn--primary" onClick={onRematch}>
                  Rematch
                </button>
                <button type="button" className="btn" onClick={onNewMatch}>
                  New match
                </button>
                <button type="button" className="btn btn--ghost" onClick={onExitToMenu}>
                  Return to menu
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirmation dialogs — rendered last so they always stack above
          any other open overlay (round/match result, pause, menu). */}
      {confirm !== null && (
        <ConfirmDialog
          title={confirmProps[confirm].title}
          message={confirmProps[confirm].message}
          confirmLabel={confirmProps[confirm].confirmLabel}
          danger={confirm === 'endMatch' || confirm === 'exit'}
          onConfirm={confirmProps[confirm].action}
          onCancel={() => {
            setConfirm(null)
            if (!menuOpen && state.status === 'playing') resumeFromUi()
          }}
        />
      )}
    </div>
  )
}
