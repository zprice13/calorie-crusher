/**
 * Theme flair: the logo — a synthwave neon-tube lightning bolt in electric
 * cyan with a hot-pink ghost echo — and floating "menacing" katakana glyphs.
 */

const BOLT_PATH = 'M70 8 L32 66 L54 66 L42 114 L96 48 L70 48 L88 8 Z'

export function Mascot({ size = 120, flexing = true }: { size?: number; flexing?: boolean }) {
  return (
    <svg
      className={`mascot ${flexing ? 'flexing' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Neon lightning bolt logo"
    >
      <defs>
        <filter id="mascot-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* hot-pink ghost echo (VHS chromatic aberration) */}
      <path
        d={BOLT_PATH}
        transform="translate(6,4)"
        fill="none"
        stroke="#ff2d9e"
        strokeWidth="4"
        strokeLinejoin="round"
        opacity="0.8"
        filter="url(#mascot-glow)"
      />
      {/* cyan neon tube, hollow center */}
      <path
        d={BOLT_PATH}
        fill="rgba(46, 230, 255, 0.12)"
        stroke="#2ee6ff"
        strokeWidth="4.5"
        strokeLinejoin="round"
        filter="url(#mascot-glow)"
      />
    </svg>
  )
}

const GLYPH = 'ゴ'

const SPOTS: Array<React.CSSProperties> = [
  { top: -14, right: 6, fontSize: '1.5rem', animationDelay: '0s' },
  { top: 4, right: -8, fontSize: '1.1rem', animationDelay: '0.4s' },
  { top: 26, right: 2, fontSize: '0.85rem', animationDelay: '0.8s' },
]

/** Floating ゴゴゴ — apply to any element with position: relative. */
export function Menacing() {
  return (
    <>
      {SPOTS.map((style, i) => (
        <span key={i} className="menacing" style={style} aria-hidden="true">
          {GLYPH}
        </span>
      ))}
    </>
  )
}
