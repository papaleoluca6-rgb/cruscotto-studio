import { useEffect, useState } from 'react'
import { BackupPanel } from '../features/backup/BackupPanel'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { Icon } from '../lib/Icon'
import { TABS, tabFromHash } from './tabs'
import { UpdateBanner } from './UpdateBanner'
import './shell.css'

const useHash = () => {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return hash
}

export function App() {
  const current = tabFromHash(useHash())
  const tab = TABS.find((t) => t.id === current)!

  return (
    <div className="shell">
      <nav className="shell-nav" aria-label="Schede">
        <span className="shell-brand">Cruscotto</span>
        {TABS.map((t) => (
          <a key={t.id} href={`#${t.id}`} className={`shell-tab${t.id === current ? ' on' : ''}`} aria-current={t.id === current ? 'page' : undefined}>
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
      <div className="shell-main">
        {current === 'impostazioni' ? (
          <SettingsScreen><BackupPanel /></SettingsScreen>
        ) : (
          <main className="ui-page">
            <h1>{tab.label}</h1>
            <div className="ui-empty"><Icon name={tab.icon} size={32} /><p>{tab.empty}</p></div>
          </main>
        )}
      </div>
      <UpdateBanner />
    </div>
  )
}
