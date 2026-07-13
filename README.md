# Speed Tic Tac Toe

A fast, local two-player Tic Tac Toe variant played face to face on one phone.
Each player has exactly **three numbered pieces** — once all six are on the
board, they keep moving in a fixed order until someone lines up three. Built as
an installable, offline-capable PWA with a dedicated tabletop layout: one
player's panel faces each end of the phone.

## Game rules

- The board is 3×3. Player 1 and Player 2 face each other across the phone.
- Each player owns three numbered pieces and a **personal color for the whole
  match: Player 1 is cyan, Player 2 is coral**. Every piece, panel, tag, and
  win effect is tinted with its owner's color.
- **X always takes the first turn of a round**, and the X/O symbols swap
  between rounds — so X is cyan in round 1 (Player 1 holds it) and coral in
  round 2 (Player 2 holds it). Symbols stay distinguishable by shape.

### Placement phase

Pieces enter the board on empty cells in this exact order:
**X1 → O1 → X2 → O2 → X3 → O3.** After every placement the board is checked
for a win.

### Movement phase

If nobody won during placement, the same order repeats forever — but now each
piece **moves** instead: tap the glowing active piece, then tap any empty cell
(it does not need to be adjacent, but it cannot stay put or land on another
piece). Tap the active piece again to cancel a selection. Wins are checked
after every move. Repeated positions are allowed — there is no automatic
repetition draw.

### Winning

Any horizontal, vertical, or diagonal line of your three pieces wins the round.

### Match play

- Formats: best of 3 (first to 2), best of 5 (first to 3), best of 7
  (first to 4), or unlimited.
- Players **swap symbols every round** while **keeping their color**: whoever
  holds X starts that round, and the color always tells you whose piece it is.
- Drawn or manually ended rounds award no point but still advance the round and
  swap symbols. Restarting a round resets board and clocks without swapping or
  scoring.

### Undo

Either player can request an undo of the last move while a round is running.
**Both players must approve** the request (in face-to-face layout the opposite
player gets a rotated approval button); cancelling costs nothing. A maximum of
**3 undos per round** applies, and the budget resets every round. All clocks
stop while the approval dialog is open; after an undo the turn timer resets in
full for the replayed turn, while duel/shared time already spent stays spent.
A pending approval does not survive a reload — it is simply cancelled.

### Clocks

Three clock modes:

- **Untimed** — no clocks at all; play until someone wins or the round is
  ended manually.
- **Speed round** — a per-turn countdown (10/20/30 seconds, the whole mode):
  run out of time on your move and you lose the round.
- **Duel clock** — chess-style per-player clocks (1/2/3 minutes each); only
  the active player's clock runs, and reaching zero loses the round. An
  optional per-turn limit can be combined with it.

Near-simultaneous deadlines are resolved by their actual expiry timestamps,
with ties broken in favor of the turn limit over the duel clock. Clocks are
computed from timestamps, not tick counters, so they stay accurate under slow
rendering; below ten seconds they display tenths and below five they pulse
red.

## Layouts and devices

Two table layouts are available, selectable in match settings and switchable
mid-game from the menu:

- **Face-to-face** — the device lies flat between the players; the far panel
  and the duplicate piece-number badges are rotated 180° so the opposite
  player reads everything right-side up. Default on tablets and on upright
  phones.
- **Side-by-side** — everything reads the same way up, for players sitting
  next to each other. Default on desktop and on phones held in landscape
  (a landscape phone is too shallow for opposite-facing panels); on landscape
  and wide screens the two player panels flank the board.

The **Auto** setting re-resolves live when a phone is rotated: upright →
face-to-face, landscape → side-by-side. Tablets keep face-to-face in both
orientations, and an explicit layout choice always overrides Auto.

In every layout the active player's panel glows and pulses in their symbol's
color while the waiting player's panel dims, so it is always obvious whose
turn it is — in addition to the explicit "PLACE X2 / MOVE O3" banner on both
panels.

### Desktop

The game is fully mouse- and keyboard-playable, and installable as a desktop
app via the browser's PWA install prompt (Chrome/Edge "Install app"):

- **Arrow keys** move a cursor across the board (appears on first key press)
- **Enter / Space** places the expected piece, or selects/moves during the
  movement phase
- **Escape** cancels a selection
- **Tab** reaches every control for full screen-reader/keyboard access

## Local setup

```bash
npm install
```

| Task             | Command             |
| ---------------- | ------------------- |
| Development      | `npm run dev`       |
| Tests            | `npm test`          |
| Type check       | `npm run typecheck` |
| Lint             | `npm run lint`      |
| Production build | `npm run build`     |
| Local preview    | `npm run preview`   |
| Regenerate icons | `npm run icons`     |

The production output in `dist/` is fully static — no backend, no external
APIs, no remote assets (fonts are system fonts, sounds are Web Audio synthesis,
icons are generated locally).

## Deployment

### Cloudflare Workers (current production setup)

The repo ships a `wrangler.jsonc` that deploys `dist/` as a static-assets-only
Worker with SPA fallback. In the Workers Builds dashboard (or locally):

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- No environment variables required.

Production: https://tictacgo.t-holkenbrink.workers.dev

### Cloudflare Pages (alternative)

- Build command: `npm run build`
- Build output directory: `dist`
- No environment variables required.

### AWS S3 + CloudFront

1. `npm run build`
2. Sync `dist/` to your bucket: `aws s3 sync dist/ s3://YOUR_BUCKET --delete`
3. Point a CloudFront distribution at the bucket (with Origin Access Control),
   default root object `index.html`.
4. Invalidate on deploy: `aws cloudfront create-invalidation --paths "/*"`.
5. Serve `sw.js` and `manifest.webmanifest` with short/no cache
   (`Cache-Control: no-cache`) so updates roll out promptly; hashed assets in
   `assets/` can be cached forever.

### SPA fallback

The app is a single route, so no rewrite rules are strictly required. If you
add client-side routes later, configure 404 → `/index.html` rewrites
(automatic on Cloudflare Pages; on CloudFront map the 403/404 error responses
to `/index.html` with a 200 status). The service worker already uses
`index.html` as its navigation fallback for offline use.

## iOS app (Capacitor)

The repo contains a native iOS app in `ios/` — a Capacitor shell that runs the
exact same web build in a WKWebView. The game code stays 100% shared; the
shell adds a real app icon, splash screen, and native haptics (UIKit impact/
notification feedback — `navigator.vibrate` does not exist in WKWebView).

Building and running requires a Mac with Xcode 15+ (iOS apps cannot be
compiled elsewhere). Node steps work anywhere:

```bash
npm install
npm run ios:sync   # builds the web app and copies it into ios/
npm run ios:open   # opens the project in Xcode (macOS only)
```

In Xcode: select the `App` target → *Signing & Capabilities* → choose your
team, then Run (⌘R) on a Simulator or a plugged-in iPhone.

### Testing the iOS app

- **Fastest (no Mac):** the PWA is the same code — open the deployed URL on an
  iPhone and *Add to Home Screen*. Anything verified there is verified for the
  shell too, except native haptics and the splash screen.
- **Simulator:** `npm run ios:sync && npm run ios:open`, then ⌘R. A free
  Apple ID is enough.
- **Your own iPhone:** plug it in, select it as the run destination, and
  enable *Developer Mode* on the phone (Settings → Privacy & Security). With a
  free Apple ID the install expires after 7 days; re-run from Xcode to renew.
- **Other people's iPhones (TestFlight):** requires the paid Apple Developer
  Program ($99/yr). In Xcode: Product → Archive → Distribute → App Store
  Connect, then add testers in the TestFlight tab. Testers install via the
  TestFlight app from a link — no cables, updates roll out automatically.
- **Automated tests:** all 91 Vitest tests and the Playwright flows exercise
  the exact JavaScript that ships inside the shell, so the CI suite covers the
  app's logic. Only the thin native layer (icon, splash, haptics bridge) needs
  the manual Simulator/device check.

After changing web code, re-run `npm run ios:sync` before building in Xcode —
it refreshes the copied web assets. `npm run icons` also regenerates the iOS
app icon and splash into the Xcode asset catalog.

## PWA / offline

The build generates a Workbox service worker (`vite-plugin-pwa`, `generateSW`)
that precaches the complete app shell. After the first successful load the game
is fully playable offline and installable to the home screen (standalone
display, portrait, dark theme colors, maskable icon included).

## Local persistence

Everything is stored in `localStorage` under versioned keys:

- `sttt.v1.prefs` — player names, clock/format/layout/sound/haptics
  preferences, and tutorial completion. Prefilled on the next visit.
- `sttt.v2.match` — the active match, saved after every meaningful action and
  on page hide. A reopened match always restores **paused** with clocks
  stopped (settled to the moment of the save). Saves that fail validation —
  unknown schema version, corrupted JSON, impossible board states — are
  discarded, never partially applied.

## Architecture

```
src/
  engine/          pure, framework-free rules engine (fully unit-tested)
    types.ts       serializable state & action types, schema constants
    rules.ts       piece order, placement/movement validation, win detection
    clocks.ts      timestamp-based clock accounting & timeout resolution
    reducer.ts     deterministic match reducer (every action carries `now`)
    persist.ts     versioned, validated localStorage save/restore
  components/      Board, PlayerPanel, PieceGlyph, ConfirmDialog
  screens/         Welcome, Setup, Config, Tutorial, GameScreen (+ overlays)
  lib/             Web Audio synth, haptics, clock formatting
  App.tsx          screen routing, clock ticker, lifecycle & persistence glue
```

The engine is a pure reducer over a serializable `MatchState`; the UI only
dispatches actions and renders state. Every action that touches time carries an
explicit `now` timestamp, which makes the engine deterministic and trivially
testable with fake clocks. Impossible states (wrong placement order, moving the
wrong piece, occupied destinations, double timeouts, actions after round end)
are rejected inside the reducer, so no UI bug can corrupt a game.

## Product decisions

- "Desktop app" means the installable PWA with full keyboard support — the
  game is entirely client-side, so no Electron wrapper is needed.
- Undo approval is by trust (two on-screen buttons); the app cannot verify
  which human tapped which button on a shared device.
- Reopening the app with an unfinished match resumes it directly (paused)
  rather than showing the menu; abandoning it via *Return to menu* discards it
  after confirmation.
- Quick play starts a match immediately with the saved names and settings.
- When the final round of a finite match ends, the celebratory match result is
  shown directly (the round's outcome is implicit in the final score).
- Ending a match manually from a tied score produces a "level" result with no
  winner.
- Rapid consecutive taps are legal (it's a speed game); invalid ones are
  ignored by the reducer rather than debounced away.
- The in-game menu automatically pauses the game so no dialog consumes clock
  time.

## Known limitations

- Confirmation dialogs and result cards read upright for Player 1; only the
  pause flag and the board's piece numbers are duplicated upside down.
- No undo — intentional for a speed game.
- Haptics depend on `navigator.vibrate`, which iOS Safari does not expose; the
  toggle degrades gracefully there.
- One saved match slot; starting a new match replaces it.

## Future: online multiplayer

The engine is already deterministic and serializable, which is the hard part:

1. Extract `engine/` as a shared package used by client and server.
2. Represent a game as an ordered log of `MatchAction`s; the authoritative
   server timestamps actions (replacing client `Date.now()`) and rebroadcasts
   them. Clients replay the log through `matchReducer` — no rules rewrite.
3. Timeouts become server-scheduled `CHECK_TIMEOUT` actions, with the same
   earliest-deadline resolution.
4. Reconnection = send the last acknowledged action index, replay the tail.
   Spectating = read-only replay of the same log.
5. Only the lobby/matchmaking layer and a WebSocket transport are new code.
