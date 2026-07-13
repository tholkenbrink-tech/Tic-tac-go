import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'
import { STORAGE_KEYS, savePrefs, DEFAULT_PREFS, saveMatch } from './engine/persist.ts'
import { createMatch, matchReducer } from './engine/reducer.ts'
import type { CellIndex } from './engine/types.ts'

function cellButton(label: RegExp) {
  return screen.getByRole('button', { name: label })
}

describe('full match integration', () => {
  it('configures a match, places, moves, wins, and swaps symbols next round', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Welcome -> setup
    await user.click(screen.getByRole('button', { name: /new match/i }))
    await user.type(screen.getByLabelText(/player 1/i), 'Ada')
    await user.type(screen.getByLabelText('Player 2 name'), 'Grace')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Configuration: untimed (no turn-limit control exists for it), best of 3
    await user.click(screen.getByRole('button', { name: 'Untimed' }))
    expect(screen.queryByRole('button', { name: 'None' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Best of 3' }))
    await user.click(screen.getByRole('button', { name: /start match/i }))

    // First-run tutorial appears automatically; skip it.
    const tutorial = await screen.findByRole('dialog', { name: /how to play/i })
    await user.click(within(tutorial).getByRole('button', { name: /skip/i }))

    // Ready screen for round 1: Ada plays X.
    const ready = await screen.findByRole('dialog', { name: /round ready/i })
    expect(within(ready).getByText(/round 1/i)).toBeInTheDocument()
    expect(within(ready).getByText(/Ada plays X and starts/i)).toBeInTheDocument()
    await user.click(within(ready).getByRole('button', { name: /start round/i }))

    // Six placements with no winner: X on cells 0,1,5 / O on 3,6,7.
    await user.click(cellButton(/place x1 on cell 1$/i))
    await user.click(cellButton(/place o1 on cell 4$/i))
    await user.click(cellButton(/place x2 on cell 2$/i))
    await user.click(cellButton(/place o2 on cell 7$/i))
    await user.click(cellButton(/place x3 on cell 6$/i))
    await user.click(cellButton(/place o3 on cell 8$/i))

    // Movement phase: X1 -> cell 3 (index 2), O1 -> cell 5 (index 4),
    // X2 -> cell 9 (index 8) wins the 3-6-9 column (indices 2,5,8).
    await user.click(cellButton(/select x1 to move/i))
    // Cancelling works: tap again deselects, then reselect.
    await user.click(cellButton(/cancel selection of x1/i))
    await user.click(cellButton(/select x1 to move/i))
    await user.click(cellButton(/move x1 to cell 3$/i))

    await user.click(cellButton(/select o1 to move/i))
    await user.click(cellButton(/move o1 to cell 5$/i))

    await user.click(cellButton(/select x2 to move/i))
    await user.click(cellButton(/move x2 to cell 9$/i))

    // Ada (X) wins the round.
    const result = await screen.findByRole('dialog', { name: /round result/i }, { timeout: 3000 })
    expect(within(result).getByText(/Ada wins the round/i)).toBeInTheDocument()
    expect(within(result).getByText(/three in a row/i)).toBeInTheDocument()

    // Next round: Grace holds X now (colors follow players, symbols swap).
    await user.click(within(result).getByRole('button', { name: /start round 2/i }))
    const ready2 = await screen.findByRole('dialog', { name: /round ready/i })
    expect(within(ready2).getByText(/round 2/i)).toBeInTheDocument()
    expect(within(ready2).getByText(/Grace plays X and starts/i)).toBeInTheDocument()
    await user.click(within(ready2).getByRole('button', { name: /start round/i }))
    // X1 is again the first placement — X always starts.
    expect(screen.getByRole('button', { name: /place x1 on cell 1$/i })).toBeInTheDocument()
  }, 20_000)

  it('defaults empty names to Player 1 / Player 2 so setup can be skipped', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /new match/i }))
    // Continue without typing anything.
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: /start match/i }))
    const tutorial = await screen.findByRole('dialog', { name: /how to play/i })
    await user.click(within(tutorial).getByRole('button', { name: /skip/i }))
    const ready = await screen.findByRole('dialog', { name: /round ready/i })
    expect(within(ready).getByText(/Player 1 plays X and starts/i)).toBeInTheDocument()
    expect(within(ready).getByText('Player 2')).toBeInTheDocument()
  })

  it('exposes global settings (sound, haptics, layout) behind the gear button', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /settings/i }))
    const sheet = await screen.findByRole('dialog', { name: /settings/i })
    // Sound and haptics live here now, not in match configuration.
    await user.click(within(sheet).getByRole('switch', { name: /sound effects/i }))
    expect(within(sheet).getByRole('switch', { name: /sound effects/i })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(within(sheet).getByRole('button', { name: 'Face-to-face' })).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: /done/i }))

    // The match configuration screen no longer contains them.
    await user.click(screen.getByRole('button', { name: /new match/i }))
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.queryByRole('switch', { name: /sound effects/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start match/i })).toBeInTheDocument()
    // The gear is available here too.
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  it('skips setup via quick play when names are saved', async () => {
    savePrefs({ ...DEFAULT_PREFS, p1Name: 'Ada', p2Name: 'Grace', tutorialDone: true })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /quick play — Ada vs Grace/i }))
    expect(await screen.findByRole('dialog', { name: /round ready/i })).toBeInTheDocument()
  })

  it('supports keyboard play: arrow keys move the cursor, Enter places', async () => {
    savePrefs({ ...DEFAULT_PREFS, p1Name: 'Ada', p2Name: 'Grace', tutorialDone: true })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /quick play/i }))
    await user.click(await screen.findByRole('button', { name: /^start round$/i }))

    // Cursor starts on the center cell (5); Enter places X1 there.
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: /cell 5, occupied by X1/i })).toBeInTheDocument()

    // Arrow up to cell 2, Enter places O1. Left twice clamps at the edge (cell 1).
    await user.keyboard('{ArrowUp}{Enter}')
    expect(screen.getByRole('button', { name: /cell 2, occupied by O1/i })).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}{ArrowLeft}{Enter}')
    expect(screen.getByRole('button', { name: /cell 1, occupied by X2/i })).toBeInTheDocument()
  })

  it('undoes the last move only after both players approve, max three per round', async () => {
    savePrefs({ ...DEFAULT_PREFS, p1Name: 'Ada', p2Name: 'Grace', tutorialDone: true })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /quick play/i }))
    await user.click(await screen.findByRole('button', { name: /^start round$/i }))
    await user.click(screen.getByRole('button', { name: /place x1 on cell 1$/i }))

    await user.click(screen.getByRole('button', { name: /undo last move, 3 of 3 left/i }))
    const dialog = await screen.findByRole('dialog', { name: /undo approval/i })

    // One approval is not enough (board is inert while the dialog is open).
    await user.click(within(dialog).getByRole('button', { name: /Ada: approve undo/i }))
    expect(screen.getByRole('button', { name: /^cell 1, x1$/i })).toBeInTheDocument()

    // Second approval reverts the placement.
    await user.click(within(dialog).getByRole('button', { name: /Grace: approve undo/i }))
    expect(screen.queryByRole('dialog', { name: /undo approval/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /place x1 on cell 1$/i })).toBeInTheDocument()

    // Budget went down; with no move to revert the control is disabled.
    const undoBtn = screen.getByRole('button', { name: /undo last move, 2 of 3 left/i })
    expect(undoBtn).toBeDisabled()

    // Cancelling costs nothing.
    await user.click(screen.getByRole('button', { name: /place x1 on cell 1$/i }))
    await user.click(screen.getByRole('button', { name: /undo last move, 2 of 3 left/i }))
    const dialog2 = await screen.findByRole('dialog', { name: /undo approval/i })
    await user.click(within(dialog2).getByRole('button', { name: /^cancel$/i }))
    expect(screen.getByRole('button', { name: /cell 1, occupied by X1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /undo last move, 2 of 3 left/i })).toBeEnabled()
  })

  it('can end the match while paused, without resuming first', async () => {
    savePrefs({ ...DEFAULT_PREFS, p1Name: 'Ada', p2Name: 'Grace', tutorialDone: true })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /quick play/i }))
    await user.click(await screen.findByRole('button', { name: /^start round$/i }))
    await user.click(screen.getByRole('button', { name: /place x1 on cell 1$/i }))
    await user.click(screen.getByRole('button', { name: /pause/i }))
    expect(screen.getByRole('dialog', { name: /game paused/i })).toBeInTheDocument()

    // The menu must stay reachable while paused.
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('button', { name: 'End match' }))
    await user.click(screen.getAllByRole('button', { name: 'End match' }).pop()!)
    const result = await screen.findByRole('dialog', { name: /match result/i }, { timeout: 3000 })
    expect(within(result).getByText(/match ended level/i)).toBeInTheDocument()
  })

  it('plays against the computer: select it in setup, it moves by itself', async () => {
    savePrefs({ ...DEFAULT_PREFS, p1Name: 'Thorben', tutorialDone: true })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /new match/i }))

    // Player 2 becomes the computer, strength selectable.
    await user.click(screen.getByRole('button', { name: /computer/i }))
    await user.click(screen.getByRole('button', { name: 'Beginner' }))
    expect(screen.getByText(/≈ 800 Elo/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: /start match/i }))

    // Ready screen shows the computer opponent by name.
    const ready = await screen.findByRole('dialog', { name: /round ready/i })
    expect(within(ready).getByText(/Computer · Beginner/i)).toBeInTheDocument()
    await user.click(within(ready).getByRole('button', { name: /^start round$/i }))

    // Human (X) places; the computer answers with O1 on its own.
    await user.click(screen.getByRole('button', { name: /place x1 on cell 5$/i }))
    await screen.findByRole(
      'button',
      { name: /cell \d, (occupied by )?O1/i },
      { timeout: 4000 },
    )
  }, 15_000)

  it('restores a saved in-progress match paused', async () => {
    savePrefs({ ...DEFAULT_PREFS, p1Name: 'Ada', p2Name: 'Grace', tutorialDone: true })
    let m = createMatch(
      { p1: 'Ada', p2: 'Grace' },
      {
        format: 'best3',
        clock: { type: 'speed', duelMs: 120_000, turnLimitMs: null },
        sound: false,
        haptics: false,
      },
    )
    m = matchReducer(m, { type: 'START_ROUND', now: 1000 })
    m = matchReducer(m, { type: 'PLACE', cell: 0 as CellIndex, now: 2000 })
    saveMatch(m, 3000)
    expect(localStorage.getItem(STORAGE_KEYS.match)).not.toBeNull()

    const user = userEvent.setup()
    render(<App />)

    // Restored directly into the game, paused.
    const pauseDialog = await screen.findByRole('dialog', { name: /game paused/i })
    expect(pauseDialog).toBeInTheDocument()
    await user.click(within(pauseDialog).getByRole('button', { name: /resume/i }))
    // X1 already on the board; O1 is up next.
    expect(screen.getByRole('button', { name: /place o1 on cell 2$/i })).toBeInTheDocument()
  })
})
