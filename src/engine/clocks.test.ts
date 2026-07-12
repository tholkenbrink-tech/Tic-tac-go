import { describe, expect, it } from 'vitest'
import {
  freshClock,
  remaining,
  resetTurnTimer,
  resolveTimeout,
  settleClock,
  startClock,
  stopClock,
} from './clocks.ts'
import type { ClockConfig } from './types.ts'

const T0 = 5_000_000

const speed: ClockConfig = { type: 'speed', duelMs: 120_000, turnLimitMs: null }
const duel: ClockConfig = { type: 'duel', duelMs: 60_000, turnLimitMs: null }
const withTurn: ClockConfig = { type: 'untimed', duelMs: 120_000, turnLimitMs: 20_000 }

describe('clock accounting', () => {
  it('derives remaining time from timestamps, not tick counts', () => {
    const c = startClock(freshClock(speed), T0)
    // A huge render gap loses no accuracy.
    expect(remaining(c, speed, 'X', T0 + 37_512).sharedMs).toBe(120_000 - 37_512)
  })

  it('only settles the active symbol on a duel clock', () => {
    const c = startClock(freshClock(duel), T0)
    const settled = settleClock(c, duel, 'X', T0 + 5_000)
    expect(settled.duelMs.X).toBe(55_000)
    expect(settled.duelMs.O).toBe(60_000)
  })

  it('stops without losing time and stays frozen', () => {
    const c = startClock(freshClock(speed), T0)
    const stopped = stopClock(c, speed, 'X', T0 + 10_000)
    expect(stopped.runningSince).toBeNull()
    expect(remaining(stopped, speed, 'X', T0 + 99_999_999).sharedMs).toBe(110_000)
  })

  it('resets only the turn timer', () => {
    const c = startClock(freshClock(withTurn), T0)
    const settled = settleClock(c, withTurn, 'X', T0 + 6_000)
    expect(settled.turnMs).toBe(14_000)
    expect(resetTurnTimer(settled, withTurn).turnMs).toBe(20_000)
  })

  it('never returns negative remaining values', () => {
    const c = startClock(freshClock(speed), T0)
    expect(remaining(c, speed, 'X', T0 + 10_000_000).sharedMs).toBe(0)
  })
})

describe('resolveTimeout', () => {
  it('returns null while nothing has expired or when stopped', () => {
    const c = startClock(freshClock(speed), T0)
    expect(resolveTimeout(c, speed, 'X', T0 + 119_999)).toBeNull()
    expect(resolveTimeout(freshClock(speed), speed, 'X', T0 + 999_999)).toBeNull()
  })

  it('picks the earliest deadline by timestamp', () => {
    const cfg: ClockConfig = { type: 'duel', duelMs: 8_000, turnLimitMs: 15_000 }
    const c = startClock(freshClock(cfg), T0)
    expect(resolveTimeout(c, cfg, 'X', T0 + 20_000)).toEqual({
      reason: 'duelTimeout',
      at: T0 + 8_000,
    })
  })

  it('prefers the turn limit on an exact tie', () => {
    const cfg: ClockConfig = { type: 'duel', duelMs: 10_000, turnLimitMs: 10_000 }
    const c = startClock(freshClock(cfg), T0)
    expect(resolveTimeout(c, cfg, 'X', T0 + 10_000)?.reason).toBe('turnTimeout')
  })

  it('prefers the duel clock over the shared clock only by timestamp order', () => {
    const cfg: ClockConfig = { type: 'speed', duelMs: 120_000, turnLimitMs: 10_000 }
    const c = startClock(freshClock(cfg), T0)
    expect(resolveTimeout(c, cfg, 'X', T0 + 130_000)?.reason).toBe('turnTimeout')
  })
})
