import { useRegisterSW } from 'virtual:pwa-register/react'
import { Icon } from '../lib/Icon'
import './update.css'

/** Versione nuova pronta: si applica solo quando lo decide l'utente. */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className="update-banner" role="status">
      <span>È disponibile una versione nuova dell'app.</span>
      <button className="ui-btn primary" onClick={() => void updateServiceWorker(true)}><Icon name="refresh" size={18} /> Aggiorna</button>
    </div>
  )
}
