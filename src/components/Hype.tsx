/**
 * Theme flair: an original hyper-muscular mascot (double-biceps flex,
 * pompadour, shades) and floating "menacing" katakana glyphs.
 */

export function Mascot({ size = 120, flexing = true }: { size?: number; flexing?: boolean }) {
  return (
    <svg
      className={`mascot ${flexing ? 'flexing' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Extremely muscular mascot flexing"
    >
      {/* burst background */}
      <g fill="#ffb300" opacity="0.25">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2
          const x1 = 60 + Math.cos(a) * 26
          const y1 = 60 + Math.sin(a) * 26
          const x2 = 60 + Math.cos(a + 0.09) * 58
          const y2 = 60 + Math.sin(a + 0.09) * 58
          const x3 = 60 + Math.cos(a - 0.09) * 58
          const y3 = 60 + Math.sin(a - 0.09) * 58
          return <polygon key={i} points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`} />
        })}
      </g>
      {/* torso: absurd V-taper */}
      <path d="M38 74 L44 52 L60 46 L76 52 L82 74 L70 78 L60 74 L50 78 Z" fill="#e8935a" />
      {/* pecs */}
      <path d="M48 56 Q60 64 72 56 Q72 66 60 68 Q48 66 48 56Z" fill="#d97f45" />
      {/* flexed arms: shoulders → towering biceps balls */}
      <circle cx="38" cy="56" r="11" fill="#e8935a" />
      <circle cx="82" cy="56" r="11" fill="#e8935a" />
      <circle cx="32" cy="42" r="10" fill="#e8935a" />
      <circle cx="88" cy="42" r="10" fill="#e8935a" />
      {/* bicep peak highlights */}
      <circle cx="30" cy="38" r="4" fill="#f7b27e" />
      <circle cx="90" cy="38" r="4" fill="#f7b27e" />
      {/* fists */}
      <circle cx="36" cy="32" r="5.5" fill="#d97f45" />
      <circle cx="84" cy="32" r="5.5" fill="#d97f45" />
      {/* tiny head, mighty pompadour */}
      <circle cx="60" cy="36" r="9" fill="#e8935a" />
      <path d="M50 32 Q52 18 66 20 Q74 22 70 30 Q66 26 60 27 Q53 28 50 32Z" fill="#1c1024" />
      {/* shades */}
      <rect x="53" y="33" width="6.5" height="4" rx="1" fill="#1c1024" />
      <rect x="61" y="33" width="6.5" height="4" rx="1" fill="#1c1024" />
      <rect x="59" y="34" width="3" height="1.6" fill="#1c1024" />
      {/* smirk */}
      <path d="M56 42 Q60 45 64 42" stroke="#1c1024" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* abs — all eight of them */}
      <g stroke="#c06a33" strokeWidth="1.4" strokeLinecap="round">
        <line x1="60" y1="50" x2="60" y2="72" />
        <line x1="53" y1="56" x2="67" y2="56" />
        <line x1="53" y1="62" x2="67" y2="62" />
        <line x1="54" y1="68" x2="66" y2="68" />
      </g>
      {/* sparkles */}
      <g fill="#fff">
        <path d="M22 24 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6Z" />
        <path d="M98 66 l1.2 2.8 2.8 1.2 -2.8 1.2 -1.2 2.8 -1.2 -2.8 -2.8 -1.2 2.8 -1.2Z" />
      </g>
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
