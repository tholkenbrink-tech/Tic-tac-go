import type { Symbol_ } from '../engine/types.ts'

/**
 * Large X / O shape. Symbols differ by geometry, never by color: the stroke
 * color comes from the owning player's tint (--pc), falling back to the
 * brand's symbol colors outside a tint context (welcome screen, tutorial).
 */
export function PieceGlyph({ symbol, size = '62%' }: { symbol: Symbol_; size?: string }) {
  if (symbol === 'X') {
    return (
      <svg className="glyph" viewBox="0 0 48 48" style={{ width: size, height: size }} aria-hidden>
        <path
          d="M10 10 L38 38 M38 10 L10 38"
          stroke="var(--pc, var(--x))"
          strokeWidth={8.5}
          strokeLinecap="round"
          fill="none"
          style={{ filter: 'drop-shadow(0 0 6px var(--pc-glow, var(--x-glow)))' }}
        />
      </svg>
    )
  }
  return (
    <svg className="glyph" viewBox="0 0 48 48" style={{ width: size, height: size }} aria-hidden>
      <circle
        cx={24}
        cy={24}
        r={14.5}
        stroke="var(--pc, var(--o))"
        strokeWidth={8.5}
        fill="none"
        style={{ filter: 'drop-shadow(0 0 6px var(--pc-glow, var(--o-glow)))' }}
      />
    </svg>
  )
}
