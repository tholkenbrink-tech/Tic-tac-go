import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { GameScreen } from './screens/GameScreen.tsx'
import { SettingsSheet } from './components/SettingsSheet.tsx'
import { Config } from './screens/Config.tsx'
import { Setup } from './screens/Setup.tsx'
import { Tutorial } from './screens/Tutorial.tsx'
import { Welcome } from './screens/Welcome.tsx'
import { activeSymbol, createMatch, matchReducer } from './engine/reducer.ts'
import { expectedPiece } from './engine/rules.ts'
import {
  clearSavedMatch,
  loadMatch,
  loadPrefs,
  saveMatch,
  savePrefs,
  type Prefs,
} from './engine/persist.ts'
import type { MatchAction, MatchConfig, MatchState } from './engine/types.ts'
import { primeAudio, setSoundEnabled, sfx } from './lib/sound.ts'
import { haptics, setHapticsEnabled } from './lib/haptics.ts'
import { resolveLayout } from './lib/device.ts'
import { aiDisplayName, chooseAiMove } from './engine/ai.ts'

type Screen = 'welcome' | 'setup' | 'config' | 'game'

type ShellAction = { type: 'SET_MATCH'; match: MatchState | null } | MatchAction

// AI move timing (in ms): "thinking" delay + random jitter
const AI_THINK_BASE = 650
const AI_THINK_JITTER = 450
const AI_MOVE_BASE = 450
const AI_MOVE_JITTER = 250

function shellReducer(match: MatchState | null, action: ShellAction): MatchState | null {
  if (action.type === 'SET_MATCH') return action.match
  return match ? matchReducer(match, action) : match
}

function configFromPrefs(prefs: Prefs): MatchConfig {
  return {
    format: prefs.format,
    clock: { type: prefs.clockType, duelMs: prefs.duelMs, turnLimitMs: prefs.turnLimitMs },
    sound: prefs.sound,
    haptics: prefs.haptics,
  }
}

export default function App() {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs())
  const [match, dispatch] = useReducer(shellReducer, null, () => loadMatch())
  const [screen, setScreen] = useState<Screen>(() => (loadMatch() ? 'game' : 'welcome'))
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      savePrefs(next)
      return next
    })
  }, [])

  // Keep audio/haptics switches in sync with preferences.
  useEffect(() => {
    setSoundEnabled(prefs.sound)
    setHapticsEnabled(prefs.haptics)
  }, [prefs.sound, prefs.haptics])

  // Unlock iOS audio on the first user gesture.
  useEffect(() => {
    const prime = () => primeAudio()
    window.addEventListener('pointerdown', prime, { once: true })
    return () => window.removeEventListener('pointerdown', prime)
  }, [])

  // Re-resolve the "auto" layout when the device rotates.
  const [, setOrientationTick] = useState(0)
  useEffect(() => {
    const mq = window.matchMedia?.('(orientation: landscape)')
    if (!mq?.addEventListener) return
    const onChange = () => setOrientationTick((n) => n + 1)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Clock ticker: re-render for time displays and detect expiry. Timestamp
  // math in the engine keeps this accurate regardless of tick rate.
  const clocksLive =
    match !== null &&
    match.status === 'playing' &&
    !match.paused &&
    match.clock.runningSince !== null &&
    (match.config.clock.type !== 'untimed' || match.config.clock.turnLimitMs !== null)
  useEffect(() => {
    if (!clocksLive) return
    const id = setInterval(() => {
      setNow(Date.now())
      dispatch({ type: 'CHECK_TIMEOUT', now: Date.now() })
    }, 100)
    return () => clearInterval(id)
  }, [clocksLive])

  // Persist the match after every meaningful change.
  useEffect(() => {
    if (!match) return
    if (match.status === 'matchComplete') clearSavedMatch()
    else saveMatch(match, Date.now())
  }, [match])

  // Auto-pause when the page is hidden; save on page hide.
  const matchRef = useRef(match)
  matchRef.current = match
  useEffect(() => {
    const onHide = () => {
      const m = matchRef.current
      if (!m) return
      if (document.visibilityState === 'hidden' && m.status === 'playing' && !m.paused) {
        dispatch({ type: 'PAUSE', now: Date.now() })
      }
    }
    const onPageHide = () => {
      const m = matchRef.current
      if (m && m.status !== 'matchComplete') saveMatch(m, Date.now())
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [])

  // Sounds and haptics on engine transitions.
  const prevRef = useRef<MatchState | null>(null)
  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = match
    if (!prev || !match || prev === match) return
    if (prev.roundResult === null && match.roundResult !== null) {
      const r = match.roundResult
      if (r.kind === 'win' && r.reason === 'line') {
        sfx.win()
        haptics.win()
      } else if (r.kind === 'draw' && r.reason === 'manual') {
        sfx.pause()
      } else {
        sfx.timeout()
        haptics.timeout()
      }
      if (match.matchResult && !match.matchResult.endedManually) sfx.matchWin()
      return
    }
    if (match.turn > prev.turn && prev.roundResult === null) {
      const moved = expectedPiece(prev.turn)
      const sym = moved[0] === 'X' ? 'X' : 'O'
      if (prev.phase === 'placement') sfx.place(sym)
      else sfx.move(sym)
      haptics.move()
      return
    }
    if (prev.undosUsed < match.undosUsed) {
      sfx.undo()
      haptics.move()
      return
    }
    if (match.selected !== null && prev.selected === null) {
      sfx.select()
      haptics.tap()
    }
  }, [match])

  // ---- computer opponent ----
  // Acts when it is the AI's turn: a short "think" delay, then (in the
  // movement phase) a visible select, then the move — fast, but readable.
  useEffect(() => {
    if (!match || !match.ai) return
    if (match.status !== 'playing' || match.paused) return
    if (match.roundResult !== null || match.undoRequest !== null) return
    const aiSymbol = match.p1Symbol === 'X' ? 'O' : 'X'
    if (activeSymbol(match) !== aiSymbol) return

    const timers: ReturnType<typeof setTimeout>[] = []
    const think = AI_THINK_BASE + Math.random() * AI_THINK_JITTER
    if (match.selected === null) {
      const decision = chooseAiMove(match)
      timers.push(
        setTimeout(() => {
          if (decision.select) dispatch({ type: 'SELECT', piece: decision.select })
          else dispatch({ type: 'PLACE', cell: decision.cell, now: Date.now() })
        }, think),
      )
    } else {
      // Piece already selected (previous effect run): finish the move.
      const decision = chooseAiMove(match)
      timers.push(
        setTimeout(
          () => dispatch({ type: 'MOVE', cell: decision.cell, now: Date.now() }),
          AI_MOVE_BASE + Math.random() * AI_MOVE_JITTER,
        ),
      )
    }
    return () => timers.forEach(clearTimeout)
  }, [match])

  // The computer approves undo requests automatically after a beat.
  useEffect(() => {
    if (!match?.ai || !match.undoRequest || match.undoRequest.approvals.p2) return
    const t = setTimeout(
      () => dispatch({ type: 'APPROVE_UNDO', player: 'p2', now: Date.now() }),
      400,
    )
    return () => clearTimeout(t)
  }, [match])

  // ---- navigation handlers ----

  const startMatch = useCallback(
    (p1: string, p2: string) => {
      const ai = prefs.p2Kind === 'computer' ? { level: prefs.aiLevel } : null
      const p2Name = ai ? aiDisplayName(ai.level) : p2
      dispatch({
        type: 'SET_MATCH',
        match: createMatch({ p1, p2: p2Name }, configFromPrefs(prefs), ai),
      })
      setScreen('game')
      if (!prefs.tutorialDone) setTutorialOpen(true)
    },
    [prefs],
  )

  const exitToMenu = useCallback(() => {
    clearSavedMatch()
    dispatch({ type: 'SET_MATCH', match: null })
    setScreen('welcome')
  }, [])

  const rematch = useCallback(() => {
    const m = matchRef.current
    if (!m) return
    dispatch({ type: 'SET_MATCH', match: createMatch({ ...m.players }, m.config, m.ai) })
  }, [])

  const savedNames =
    prefs.p2Kind === 'computer'
      ? prefs.p1Name.trim()
        ? { p1: prefs.p1Name, p2: aiDisplayName(prefs.aiLevel) }
        : null
      : prefs.p1Name.trim() && prefs.p2Name.trim() && prefs.p1Name !== prefs.p2Name
        ? { p1: prefs.p1Name, p2: prefs.p2Name }
        : null

  // Live status announcement for assistive tech.
  let announcement = ''
  if (match) {
    if (match.status === 'ready') announcement = `Round ${match.roundNumber} ready.`
    else if (match.status === 'playing' && match.paused) announcement = 'Game paused.'
    else if (match.status === 'playing') {
      const piece = expectedPiece(match.turn)
      const player = match.players[match.p1Symbol === activeSymbol(match) ? 'p1' : 'p2']
      announcement = `${player}: ${match.phase === 'placement' ? 'place' : 'move'} ${piece}.`
    } else if (match.roundResult) {
      announcement =
        match.roundResult.kind === 'win'
          ? `${match.players[match.roundResult.winner]} wins the round.`
          : 'Round drawn.'
    }
    if (match.matchResult) {
      announcement = match.matchResult.winner
        ? `${match.players[match.matchResult.winner]} wins the match.`
        : 'Match ended level.'
    }
  }

  return (
    <div className={`app${screen === 'game' ? ' app--game' : ''}`}>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {screen === 'welcome' && (
        <Welcome
          savedNames={savedNames}
          onNewMatch={() => setScreen('setup')}
          onQuickPlay={() => {
            if (savedNames) startMatch(savedNames.p1, savedNames.p2)
          }}
          onHowToPlay={() => setTutorialOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {screen === 'setup' && (
        <Setup
          initialP1={prefs.p1Name}
          initialP2={prefs.p2Name}
          initialP2Kind={prefs.p2Kind}
          initialAiLevel={prefs.aiLevel}
          onBack={() => setScreen('welcome')}
          onContinue={(p1, p2, opponent) => {
            if (opponent.kind === 'computer') {
              updatePrefs({ p1Name: p1, p2Kind: 'computer', aiLevel: opponent.level })
            } else {
              updatePrefs({ p1Name: p1, p2Name: p2, p2Kind: 'human' })
            }
            setScreen('config')
          }}
        />
      )}

      {screen === 'config' && (
        <Config
          prefs={prefs}
          onChange={updatePrefs}
          onBack={() => setScreen('setup')}
          onStart={() => startMatch(prefs.p1Name, prefs.p2Name)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {screen === 'game' && match && (
        <GameScreen
          state={match}
          now={now}
          layout={match.ai ? 'sideBySide' : resolveLayout(prefs.layout)}
          onToggleLayout={() =>
            updatePrefs({
              layout: resolveLayout(prefs.layout) === 'faceToFace' ? 'sideBySide' : 'faceToFace',
            })
          }
          dispatch={dispatch}
          onExitToMenu={exitToMenu}
          onRematch={rematch}
          onNewMatch={() => {
            clearSavedMatch()
            dispatch({ type: 'SET_MATCH', match: null })
            setScreen('setup')
          }}
        />
      )}

      {settingsOpen && (
        <SettingsSheet prefs={prefs} onChange={updatePrefs} onClose={() => setSettingsOpen(false)} />
      )}

      {tutorialOpen && (
        <Tutorial
          onDone={() => {
            setTutorialOpen(false)
            if (!prefs.tutorialDone) updatePrefs({ tutorialDone: true })
          }}
        />
      )}
    </div>
  )
}
