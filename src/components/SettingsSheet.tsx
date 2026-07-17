import { ControlIcon } from './ControlIcon.tsx'
import type { LayoutPref, Prefs } from '../engine/persist.ts'
import { defaultLayout, isTablet, isTouchDevice } from '../lib/device.ts'

interface SettingsSheetProps {
  prefs: Prefs
  onChange: (patch: Partial<Prefs>) => void
  onClose: () => void
}

function autoLayoutHint(): string {
  if (!isTouchDevice())
    return 'Auto on this device: side-by-side — both panels face the same way for players sharing a screen.'
  if (isTablet())
    return 'Auto on this device: face-to-face — lay it flat between you; the far panel is rotated for the opposite player.'
  return defaultLayout() === 'faceToFace'
    ? 'Auto on this phone: face-to-face when upright, side-by-side when rotated to landscape.'
    : 'Auto on this phone: side-by-side in landscape, face-to-face when upright.'
}

/** Global app settings (not match-specific), opened from the ⚙ button. */
export function SettingsSheet({ prefs, onChange, onClose }: SettingsSheetProps) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="overlay-card" style={{ textAlign: 'left' }}>
        <h2 style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ControlIcon type="gear" size="0.85em" /> Settings
        </h2>

        <div className="toggle-row">
          <span style={{ fontWeight: 700 }}>Sound effects</span>
          <button
            type="button"
            role="switch"
            className="switch"
            aria-checked={prefs.sound}
            aria-label="Sound effects"
            onClick={() => onChange({ sound: !prefs.sound })}
          />
        </div>
        <div className="toggle-row">
          <span style={{ fontWeight: 700 }}>Haptic feedback</span>
          <button
            type="button"
            role="switch"
            className="switch"
            aria-checked={prefs.haptics}
            aria-label="Haptic feedback"
            onClick={() => onChange({ haptics: !prefs.haptics })}
          />
        </div>

        <h3>Table layout</h3>
        <div className="seg" role="group" aria-label="Table layout">
          {(
            [
              ['auto', 'Auto'],
              ['faceToFace', 'Face-to-face'],
              ['sideBySide', 'Side-by-side'],
            ] as [LayoutPref, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={prefs.layout === value}
              onClick={() => onChange({ layout: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="hint">
          {prefs.layout === 'auto' && autoLayoutHint()}
          {prefs.layout === 'faceToFace' &&
            'Device lies flat between you; the far panel is rotated for the opposite player.'}
          {prefs.layout === 'sideBySide' &&
            'Both panels face the same way — for players sitting next to each other.'}
        </p>

        <button type="button" className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}
