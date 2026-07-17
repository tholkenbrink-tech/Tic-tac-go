import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles.css'

// The service worker activates a new version in the background (skipWaiting +
// clientsClaim), but an already-open tab keeps running the JS it already
// loaded until it reloads. Force that reload once, and nudge the SW to check
// for updates whenever the app is foregrounded — otherwise an installed PWA
// that's rarely fully quit can be stuck on a stale build indefinitely.
if ('serviceWorker' in navigator) {
  let reloadedForUpdate = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForUpdate) return
    reloadedForUpdate = true
    window.location.reload()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then((r) => r?.update())
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
