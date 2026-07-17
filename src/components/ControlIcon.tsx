type IconType = 'pause' | 'resume' | 'undo' | 'menu'

export function ControlIcon({ type, size = '1em' }: { type: IconType; size?: string }) {
  const style = { width: size, height: size }

  if (type === 'pause') {
    return (
      <svg viewBox="0 0 48 48" style={style} aria-hidden fill="currentColor">
        <rect x={10} y={8} width={8} height={32} rx={2} />
        <rect x={30} y={8} width={8} height={32} rx={2} />
      </svg>
    )
  }

  if (type === 'resume') {
    return (
      <svg viewBox="0 0 48 48" style={style} aria-hidden fill="currentColor">
        <path d="M12 6 L12 42 L38 24 Z" />
      </svg>
    )
  }

  if (type === 'undo') {
    return (
      <svg viewBox="0 0 48 48" style={style} aria-hidden fill="currentColor">
        <path d="M 36 12 Q 28 12 24 18 Q 22 20 22 20 L 28 14 M 12 26 Q 20 26 24 20 Q 26 18 26 18 L 20 24" />
      </svg>
    )
  }

  if (type === 'menu') {
    return (
      <svg viewBox="0 0 48 48" style={style} aria-hidden fill="currentColor">
        <rect x={8} y={10} width={32} height={4} rx={2} />
        <rect x={8} y={22} width={32} height={4} rx={2} />
        <rect x={8} y={34} width={32} height={4} rx={2} />
      </svg>
    )
  }

  return null
}
