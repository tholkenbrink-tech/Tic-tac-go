/**
 * Timestamp-based clock logic. Clocks store remaining durations plus the
 * timestamp they started running; live values are derived from `now`, so
 * accuracy never depends on render frequency.
 */

import type { ClockConfig, ClockState, RoundEndReason, Symbol_ } from './types.ts'

export function freshClock(config: ClockConfig): ClockState {
  return {
    runningSince: null,
    duelMs: { X: config.duelMs, O: config.duelMs },
    turnMs: config.turnLimitMs ?? 0,
  }
}

export function startClock(clock: ClockState, now: number): ClockState {
  return { ...clock, runningSince: now }
}

/**
 * Fold elapsed time since `runningSince` into the stored remaining values for
 * every clock that is actually ticking (shared always, duel for the active
 * symbol, and the turn timer). Result keeps running from `now`.
 */
export function settleClock(
  clock: ClockState,
  config: ClockConfig,
  activeSymbol: Symbol_,
  now: number,
): ClockState {
  if (clock.runningSince === null) return clock
  const elapsed = Math.max(0, now - clock.runningSince)
  return {
    runningSince: now,
    duelMs:
      config.type === 'duel'
        ? { ...clock.duelMs, [activeSymbol]: Math.max(0, clock.duelMs[activeSymbol] - elapsed) }
        : clock.duelMs,
    turnMs: config.turnLimitMs !== null ? Math.max(0, clock.turnMs - elapsed) : clock.turnMs,
  }
}

/** Settle, then stop the clock (for pausing / round end). */
export function stopClock(
  clock: ClockState,
  config: ClockConfig,
  activeSymbol: Symbol_,
  now: number,
): ClockState {
  return { ...settleClock(clock, config, activeSymbol, now), runningSince: null }
}

/** Reset the turn timer to its full limit (after each valid action). */
export function resetTurnTimer(clock: ClockState, config: ClockConfig): ClockState {
  if (config.turnLimitMs === null) return clock
  return { ...clock, turnMs: config.turnLimitMs }
}

/** Live remaining values at `now` for display. */
export function remaining(
  clock: ClockState,
  config: ClockConfig,
  activeSymbol: Symbol_,
  now: number,
): { duelMs: Record<Symbol_, number>; turnMs: number } {
  const settled =
    clock.runningSince === null ? clock : settleClock(clock, config, activeSymbol, now)
  return { duelMs: settled.duelMs, turnMs: settled.turnMs }
}

export interface TimeoutResolution {
  reason: Extract<RoundEndReason, 'turnTimeout' | 'duelTimeout'>
  /** The absolute timestamp at which the deadline passed. */
  at: number
}

/**
 * Determine which deadline (if any) has passed at `now`, resolving by actual
 * expiry timestamps. Ties break in the order: turn limit, duel clock.
 */
export function resolveTimeout(
  clock: ClockState,
  config: ClockConfig,
  activeSymbol: Symbol_,
  now: number,
): TimeoutResolution | null {
  if (clock.runningSince === null) return null
  const since = clock.runningSince
  const candidates: TimeoutResolution[] = []
  if (config.turnLimitMs !== null) {
    candidates.push({ reason: 'turnTimeout', at: since + clock.turnMs })
  }
  if (config.type === 'duel') {
    candidates.push({ reason: 'duelTimeout', at: since + clock.duelMs[activeSymbol] })
  }
  const priority: Record<TimeoutResolution['reason'], number> = {
    turnTimeout: 0,
    duelTimeout: 1,
  }
  const passed = candidates
    .filter((c) => c.at <= now)
    .sort((a, b) => a.at - b.at || priority[a.reason] - priority[b.reason])
  return passed[0] ?? null
}
