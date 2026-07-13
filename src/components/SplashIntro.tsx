import { useEffect, useState } from 'react'
import { Mascot } from './Hype'

const DURATION_MS = 2600

/**
 * Launch animation: manga burst background, the mascot slams in with a
 * screen shake, the title smashes together, menacing glyphs pop in, then
 * the whole thing flashes out. Tap anywhere to skip. Honors
 * prefers-reduced-motion with a quick plain fade.
 */
export default function SplashIntro({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const total = reducedMotion ? 900 : DURATION_MS
    const leaveAt = setTimeout(() => setLeaving(true), total - 380)
    const done = setTimeout(onDone, total)
    return () => {
      clearTimeout(leaveAt)
      clearTimeout(done)
    }
  }, [onDone, reducedMotion])

  if (reducedMotion) {
    return (
      <div
        className={`splash splash-reduced ${leaving ? 'splash-leave' : ''}`}
        onClick={onDone}
        role="presentation"
      >
        <div className="splash-title">
          <span>Calorie</span>
          <span>Crusher</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`splash ${leaving ? 'splash-leave' : ''}`}
      onClick={onDone}
      role="presentation"
      aria-label="Calorie Crusher"
    >
      <div className="splash-burst" />
      <div className="splash-flash" />
      <div className="splash-shake">
        <div className="splash-mascot">
          <Mascot size={190} flexing={false} />
        </div>
        <div className="splash-title">
          <span className="from-left">Calorie</span>
          <span className="from-right">Crusher</span>
        </div>
        <div className="splash-tagline">Crush kcal · Acquire gains</div>
      </div>
      {(['ゴ', 'ゴ', 'ゴ', 'ゴ'] as const).map((g, i) => (
        <span key={i} className={`splash-glyph splash-glyph-${i + 1}`} aria-hidden="true">
          {g}
        </span>
      ))}
      <div className="splash-skip">Tap to skip</div>
    </div>
  )
}
