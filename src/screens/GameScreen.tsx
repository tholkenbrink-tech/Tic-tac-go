import { useEffect, useRef, useState } from 'react'
import { Board } from '../components/Board.tsx'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { PlayerPanel } from '../components/PlayerPanel.tsx'
import { Tutorial } from './Tutorial.tsx'
import { symbolForPlayer } from '../engine/reducer.ts'
import type {
  CellIndex,
  MatchAction,
  MatchState,
  PieceId,
  RoundResult,
} from '../engine/types.ts'

interface GameScreenProps {
  state: MatchState
  now: number
  dispatch: (action: MatchAction) => void
  onExitToMenu: () => void
  onRematch: () => void
  onNewMatch: () => void
}

type Confirm = 'restart' | 'endRound' | 'endMatch' | 'exit' | null

const REASON_TEXT: Record<Exclude<RoundResult['reason'], never>, string> = {
  line: 'Three in a row',
  turnTimeout: 'Turn time expired',
  duelTimeout: 'Duel clock expired',
  speedTimeout: 'Speed round time expired',
  manual: 'Round ended manually',
}

function clockRules(state: MatchState): { k: string; v: string }[] {
  const c = state.config.clock
  const rules: { k: string; v: string }[] = []
  if (c.type === 'untimed') rules.push({ k: 'Clock', v: 'Untimed' })
  if (c.type === 'speed') rules.push({ k: 'Clock', v: 'Speed round · shared 2:00' })
  if (c.type === 'duel') rules.push({ k: 'Clock', v: `Duel · ${c.duelMs / 60_000} min each` })
  rules.push({
    k: 'Turn limit',
    v: c.turnLimitMs === null ? 'None' : `${c.turnLimitMs / 1000}s per turn`,
  })
  rules.push({
    k: 'Format',
    v: state.winsNeeded === null ? 'Unlimited' : `First to ${state.winsNeeded} wins`,
  })
  return rules
}

function Confetti() {
  const pieces = Array.from({ length: 60 }, (_, i) => {
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
  dispatch,
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
    restart: {
      title: 'Restart this round?',
      message:
        'The board and clocks reset. The round number and X/O assignments stay the same. Nobody scores.',
      confirmLabel: 'Restart round',
      action: () => {
        dispatch({ type: 'RESTART_ROUND' })
        closeMenu(false)
      },
    },
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

  const nextRoundP1Sym = state.p1Symbol === 'X' ? 'O' : 'X'

  return (
    <div className="game">
      <PlayerPanel state={state} viewer="p2" now={now} />

      <div className="game-mid">
        <Board
          state={state}
          onCellTap={(cell: CellIndex) => {
            if (state.phase === 'placement') dispatch({ type: 'PLACE', cell, now: Date.now() })
            else if (state.selected) dispatch({ type: 'MOVE', cell, now: Date.now() })
          }}
          onPieceTap={(piece: PieceId) => {
            if (state.selected === piece) dispatch({ type: 'DESELECT' })
            else dispatch({ type: 'SELECT', piece })
          }}
        />
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
            {state.paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        )}
        <button type="button" className="ctl" onClick={openMenu}>
          ☰ Menu
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
              <span>
                {state.players.p1} <span className={`sym sym--${p1Sym.toLowerCase()}`}>{p1Sym}</span>
              </span>
              <span className="vs">VS</span>
              <span>
                <span className={`sym sym--${p2Sym.toLowerCase()}`}>{p2Sym}</span> {state.players.p2}
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

      {/* Pause overlay */}
      {playing && state.paused && !menuOpen && !rulesOpen && confirm === null && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Game paused">
          <div className="overlay-card">
            <p className="pause-flag flip" aria-hidden>
              ⏸ Paused
            </p>
            <button
              type="button"
              className="btn btn--primary"
              style={{ minHeight: 64 }}
              onClick={() => {
                menuPausedRef.current = false
                dispatch({ type: 'RESUME', now: Date.now() })
              }}
            >
              ▶ Resume
            </button>
            <p className="pause-flag">⏸ Paused</p>
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
              <button type="button" className="btn" onClick={() => setRulesOpen(true)}>
                Show rules
              </button>
              {(playing || state.status === 'ready') && (
                <button type="button" className="btn" onClick={() => setConfirm('restart')}>
                  Restart round
                </button>
              )}
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
              <button type="button" className="btn btn--ghost" onClick={() => setConfirm('exit')}>
                Return to menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules overlay (tutorial) */}
      {rulesOpen && (
        <Tutorial
          onDone={() => {
            setRulesOpen(false)
          }}
        />
      )}

      {/* Confirmation dialogs */}
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

      {/* Round result */}
      {state.status === 'roundComplete' && state.roundResult && resultVisible && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Round result">
          <div className="overlay-card">
            {state.roundResult.kind === 'win' ? (
              <>
                <p
                  className={`result-headline result-headline--${state.roundResult.winnerSymbol.toLowerCase()}`}
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
              Next round: {state.players[nextRoundP1Sym === 'X' ? 'p1' : 'p2']} plays X ·{' '}
              {state.players[nextRoundP1Sym === 'X' ? 'p2' : 'p1']} plays O
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
                    className={`result-headline result-headline--${symbolForPlayer(state, state.matchResult.winner).toLowerCase()}`}
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
    </div>
  )
}
