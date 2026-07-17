type IconType = 'pause' | 'resume' | 'undo' | 'menu' | 'gear' | 'help'

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
      <svg viewBox="0 0 48 48" style={style} aria-hidden fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M 8 16 Q 8 10 14 10 L 24 10 Q 36 10 36 18" />
        <polyline points="30,22 38,14 30,6" />
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

  if (type === 'gear') {
    const teeth = Array.from({ length: 8 }, (_, i) => (
      <rect key={i} x={21} y={2} width={6} height={10} rx={2} transform={`rotate(${i * 45} 24 24)`} />
    ))
    return (
      <svg viewBox="0 0 48 48" style={style} aria-hidden fill="currentColor">
        {teeth}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M24 15a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM24 19.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z"
        />
      </svg>
    )
  }

  if (type === 'help') {
    return (
      <svg viewBox="0 0 48 48" style={style} aria-hidden fill="currentColor">
        <path d="M24 6c-7.2 0-12.5 4.7-12.5 11.4h7.2c0-3.1 2.1-5.1 5.3-5.1 3 0 5.1 1.8 5.1 4.5 0 2.2-1.3 3.6-3.5 5.3-3.1 2.4-4.9 4.5-4.9 8.6v1.1h7.1v-0.7c0-2.7 1.1-4 3.8-6.1 2.8-2.2 4.7-4.7 4.7-8.4C36.3 10.6 31.2 6 24 6z" />
        <circle cx={24} cy={39} r={4.2} />
      </svg>
    )
  }

  return null
}
