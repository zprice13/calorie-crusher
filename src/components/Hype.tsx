/**
 * Theme flair: an original mascot — a stark bodybuilder silhouette
 * (front double-biceps) breaking out of a gradient triangle frame —
 * and floating "menacing" katakana glyphs.
 */

export function Mascot({ size = 120, flexing = true }: { size?: number; flexing?: boolean }) {
  return (
    <svg
      className={`mascot ${flexing ? 'flexing' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Bodybuilder silhouette flexing inside a triangle"
    >
      <defs>
        <linearGradient id="mascot-tri" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff2d78" />
          <stop offset="1" stopColor="#ffb300" />
        </linearGradient>
      </defs>
      {/* triangle frame */}
      <path
        d="M60 6 L112 106 L8 106 Z"
        fill="none"
        stroke="url(#mascot-tri)"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      {/* silhouette: overlapping shapes, one fill; limbs are round-capped strokes */}
      <g fill="#f2eaff">
        <circle cx="60" cy="21.5" r="6.2" />
        {/* traps sloping into the delts */}
        <path d="M46 45 C48.5 35 54 31.5 60 31.5 C66 31.5 71.5 35 74 45 Z" />
        {/* chest slab (fills the sternum between the pecs) */}
        <path d="M44 42 L76 42 L72 60 L48 60 Z" />
        <circle cx="42" cy="44" r="8.5" />
        <circle cx="78" cy="44" r="8.5" />
        {/* left arm: upper arm, bicep peak, forearm curling in, fist */}
        <line x1="42" y1="44" x2="26" y2="40" stroke="#f2eaff" strokeWidth="10" strokeLinecap="round" />
        <circle cx="32" cy="39" r="7.5" />
        <line x1="26" y1="40" x2="34" y2="22" stroke="#f2eaff" strokeWidth="8" strokeLinecap="round" />
        <circle cx="35.5" cy="20" r="5" />
        {/* right arm */}
        <line x1="78" y1="44" x2="94" y2="40" stroke="#f2eaff" strokeWidth="10" strokeLinecap="round" />
        <circle cx="88" cy="39" r="7.5" />
        <line x1="94" y1="40" x2="86" y2="22" stroke="#f2eaff" strokeWidth="8" strokeLinecap="round" />
        <circle cx="84.5" cy="20" r="5" />
        {/* torso: lats flare then hard V-taper to the waist */}
        <path d="M35 42 C41 46 50 47.5 60 47.5 C70 47.5 79 46 85 42 C84 58 73 68 69 82 L51 82 C47 68 36 58 35 42 Z" />
        <ellipse cx="52.5" cy="51" rx="9" ry="6.5" />
        <ellipse cx="67.5" cy="51" rx="9" ry="6.5" />
        {/* hips + legs planted on the triangle base */}
        <path d="M52 79 L68 79 L70 88 L50 88 Z" />
        <line x1="55" y1="85" x2="52.5" y2="97" stroke="#f2eaff" strokeWidth="10" strokeLinecap="round" />
        <line x1="52.5" y1="97" x2="52" y2="107" stroke="#f2eaff" strokeWidth="7" strokeLinecap="round" />
        <line x1="65" y1="85" x2="67.5" y2="97" stroke="#f2eaff" strokeWidth="10" strokeLinecap="round" />
        <line x1="67.5" y1="97" x2="68" y2="107" stroke="#f2eaff" strokeWidth="7" strokeLinecap="round" />
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
