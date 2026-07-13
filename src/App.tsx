import { useState } from 'react'
import DiaryPage from './pages/DiaryPage'
import ScanPage from './pages/ScanPage'
import WeightPage from './pages/WeightPage'
import ExercisePage from './pages/ExercisePage'
import SettingsPage from './pages/SettingsPage'
import { ToastProvider } from './components/Toast'

type Tab = 'diary' | 'scan' | 'weight' | 'exercise' | 'settings'

const TABS: Array<{ id: Tab; label: string; icon: JSX.Element }> = [
  {
    id: 'diary',
    label: 'Diary',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" />
        <path d="M9 8h6M9 12h6" />
      </svg>
    ),
  },
  {
    id: 'scan',
    label: 'Scan',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
        <path d="M7 8v8M11 8v8M15 8v8M17.5 8v8" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    id: 'weight',
    label: 'Weight',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 17l5-6 4 3 6-8 3 4" />
        <path d="M3 21h18" />
      </svg>
    ),
  },
  {
    id: 'exercise',
    label: 'Exercise',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Goals',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a7.97 7.97 0 0 0 .1-6l-2.1.6a6 6 0 0 0-1.4-1.4l.6-2.1a8 8 0 0 0-6 0l.6 2.1a6 6 0 0 0-1.4 1.4L7.7 9a7.97 7.97 0 0 0-.1 6l2.1-.6a6 6 0 0 0 1.4 1.4l-.6 2.1a8 8 0 0 0 6 0l-.6-2.1a6 6 0 0 0 1.4-1.4l2.1.6Z" />
      </svg>
    ),
  },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('diary')

  return (
    <ToastProvider>
      <div className="app">
        <main className="page">
          {tab === 'diary' && <DiaryPage />}
          {tab === 'scan' && <ScanPage onLogged={() => setTab('diary')} />}
          {tab === 'weight' && <WeightPage />}
          {tab === 'exercise' && <ExercisePage />}
          {tab === 'settings' && <SettingsPage />}
        </main>
        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`nav-btn ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
                aria-label={t.label}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </ToastProvider>
  )
}
