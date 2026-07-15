import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

registerSW({ immediate: true })

// iOS standalone quirk: the web viewport can be shorter than the screen (by
// the status-bar inset) and nothing paints below it — the home indicator
// then sits in that unpaintable strip, not over the nav. When detected,
// .viewport-clipped slims the nav (no indicator padding needed) and the
// nav-colored document background makes the strip read as the nav's base.
function detectClippedViewport() {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  const gap = window.screen.height - window.innerHeight
  document.documentElement.classList.toggle('viewport-clipped', standalone && gap >= 20)
}
detectClippedViewport()
window.addEventListener('orientationchange', () => setTimeout(detectClippedViewport, 300))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
