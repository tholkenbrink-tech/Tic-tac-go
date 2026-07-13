import { remaining } from '../engine/clocks.ts'
import { activeSymbol, playerForSymbol, symbolForPlayer } from '../engine/reducer.ts'
import { expectedPiece, followingPiece } from '../engine/rules.ts'
import { formatClock, isUrgent } from '../lib/format.ts'
import type { MatchState, PlayerId, Symbol_ } from '../engine/types.ts'

interface PanelProps {
  state: MatchState
  /** Which player this panel faces. p2's panel is rotated 180°. */
  viewer: PlayerId
  now: number
}

function SymbolTag({ symbol }: { symbol: Symbol_ }) {
  return <span className={`sym sym--${symbol.toLowerCase()}`}>{symbol}</span>
}

export function PlayerPanel({ state, viewer, now }: PanelProps) {
  const other: PlayerId = viewer === 'p1' ? 'p2' : 'p1'
  const viewerSymbol = symbolForPlayer(state, viewer)
  const otherSymbol = symbolForPlayer(state, other)
  const active = activeSymbol(state)
  const activePlayer = playerForSymbol(state, active)
  const isMyTurn = activePlayer === viewer
  const playing = state.status === 'playing' && !state.paused && state.roundResult === null
  const piece = expectedPiece(state.turn, state.startingSymbol)
  const nextPiece = followingPiece(state.turn, state.startingSymbol)
  const verb = state.phase === 'placement' ? 'PLACE' : 'MOVE'

  const clock = state.config.clock
  const rem = remaining(state.clock, clock, active, playing ? now : state.clock.runningSince ?? now)

  const activeClass = playing
    ? isMyTurn
      ? ` panel--active-${active.toLowerCase()}`
      : ' panel--waiting'
    : ''

  const roundInfo =
    state.winsNeeded !== null
      ? `RD ${state.roundNumber} · FIRST TO ${state.winsNeeded}`
      : `RD ${state.roundNumber}`

  let statusText: string
  if (state.paused) statusText = 'PAUSED'
  else if (state.status === 'ready') statusText = 'GET READY'
  else if (state.roundResult) statusText = 'ROUND OVER'
  else statusText = isMyTurn ? 'YOUR TURN' : `${state.players[activePlayer]}'S TURN`

  return (
    <section
      className={`panel panel--${viewer}${activeClass}`}
      aria-label={`Status for ${state.players[viewer]}`}
    >
      <div className="panel-score">
        <span className={`panel-player is-me`}>
          <span className="name">{state.players[viewer]}</span>
          <SymbolTag symbol={viewerSymbol} />
        </span>
        <span className="panel-mid-score" aria-label="Score">
          {state.scores[viewer]}–{state.scores[other]}
        </span>
        <span className="panel-player">
          <SymbolTag symbol={otherSymbol} />
          <span className="name">{state.players[other]}</span>
        </span>
        <span className="panel-round">{roundInfo}</span>
      </div>

      <div className="panel-status">
        <div className="turn-banner">
          {state.paused || state.status !== 'playing' || state.roundResult ? (
            <span className="turn-verb turn-verb--dim">{statusText}</span>
          ) : (
            <>
              <span className={`turn-verb turn-verb--${active.toLowerCase()}`}>
                {verb} {piece}
              </span>
              <span className="turn-next">
                {isMyTurn ? 'you' : statusText.toLowerCase()} · next {nextPiece}
              </span>
            </>
          )}
        </div>

        <div className="clocks">
          {clock.type === 'speed' && (
            <div
              className={`clock clock--mine${playing && isUrgent(rem.sharedMs) ? ' clock--urgent' : ''}`}
            >
              <span className="clock-label">Round</span>
              <span className="clock-value">{formatClock(rem.sharedMs)}</span>
            </div>
          )}
          {clock.type === 'duel' && (
            <>
              <div
                className={`clock clock--mine${
                  playing && isMyTurn && isUrgent(rem.duelMs[viewerSymbol])
                    ? ' clock--urgent'
                    : ''
                }`}
              >
                <span className="clock-label">You</span>
                <span className="clock-value">{formatClock(rem.duelMs[viewerSymbol])}</span>
              </div>
              <div className="clock clock--theirs">
                <span className="clock-label">Them</span>
                <span className="clock-value">{formatClock(rem.duelMs[otherSymbol])}</span>
              </div>
            </>
          )}
          {clock.turnLimitMs !== null && (
            <div
              className={`clock${playing && isUrgent(rem.turnMs) ? ' clock--urgent' : ''}${
                isMyTurn ? ' clock--mine' : ' clock--theirs'
              }`}
            >
              <span className="clock-label">Turn</span>
              <span className="clock-value">{formatClock(rem.turnMs)}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
