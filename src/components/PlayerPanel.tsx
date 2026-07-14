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

function SymbolTag({ symbol, owner }: { symbol: Symbol_; owner: PlayerId }) {
  return <span className={`sym tint-${owner}`}>{symbol}</span>
}

export function PlayerPanel({ state, viewer, now }: PanelProps) {
  const other: PlayerId = viewer === 'p1' ? 'p2' : 'p1'
  const viewerSymbol = symbolForPlayer(state, viewer)
  const otherSymbol = symbolForPlayer(state, other)
  const active = activeSymbol(state)
  const activePlayer = playerForSymbol(state, active)
  const isMyTurn = activePlayer === viewer
  const playing = state.status === 'playing' && !state.paused && state.roundResult === null
  const piece = expectedPiece(state.turn)
  const nextPiece = followingPiece(state.turn)
  const verb = state.phase === 'placement' ? 'PLACE' : 'MOVE'

  const clock = state.config.clock
  const rem = remaining(state.clock, clock, active, playing ? now : state.clock.runningSince ?? now)

  const activeClass = playing ? (isMyTurn ? ' panel--active' : ' panel--waiting') : ''

  let statusText: string
  if (state.paused) statusText = 'PAUSED'
  else if (state.status === 'ready') statusText = 'GET READY'
  else if (state.roundResult) statusText = 'ROUND OVER'
  else statusText = isMyTurn ? 'YOUR TURN' : 'WAITING…'

  return (
    <section
      className={`panel panel--${viewer} tint-${viewer}${activeClass}`}
      aria-label={`Status for ${state.players[viewer]}`}
    >
      <div className="panel-score">
        <span className={`panel-player is-me`}>
          <span className="name">{state.players[viewer]}</span>
          <SymbolTag symbol={viewerSymbol} owner={viewer} />
        </span>
        <span className="panel-mid-score" aria-label="Score">
          {state.scores[viewer]}–{state.scores[other]}
        </span>
        <span className="panel-player">
          <SymbolTag symbol={otherSymbol} owner={other} />
          <span className="name">{state.players[other]}</span>
        </span>
      </div>

      <div className="panel-status">
        <div className="turn-banner">
          {state.paused || state.status !== 'playing' || state.roundResult ? (
            <span className="turn-verb turn-verb--dim">{statusText}</span>
          ) : isMyTurn ? (
            <>
              {/* The imperative verb is only ever shown to the player who acts. */}
              <span className={`turn-verb turn-verb--pc tint-${activePlayer}`}>
                {verb} {piece}
              </span>
              <span className="turn-next">
                your turn ({piece}) · next {nextPiece}
              </span>
            </>
          ) : (
            <>
              <span className="turn-verb turn-verb--dim">WAITING…</span>
              <span className="turn-next">
                {state.players[activePlayer]}&apos;s turn ({piece}) · your next: {nextPiece}
              </span>
            </>
          )}
        </div>

        <div className="clocks">
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
