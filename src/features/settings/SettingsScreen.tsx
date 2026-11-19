import type { ReactNode } from 'react'
import { useSetting } from '../../db/settings'
import { isValidTimeZone } from '../../lib/time'
import { AiSettings } from './AiSettings'
import { ListSetting, NumberSetting, TextSetting } from './fields'
import { SubjectsEditor } from './SubjectsEditor'
import './settings.css'

const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

export function SettingsScreen({ children }: { children?: ReactNode }) {
  const winStart = useSetting('study.windowStart')
  const winEnd = useSetting('study.windowEnd')
  // "HH:MM" si confronta come testo.
  const checkStart = (v: string) => (!isTime(v) ? 'scrivi un orario HH:MM' : v >= winEnd ? `deve venire prima della fine (${winEnd})` : undefined)
  const checkEnd = (v: string) => (!isTime(v) ? 'scrivi un orario HH:MM' : v <= winStart ? `deve venire dopo l'inizio (${winStart})` : undefined)
  return (
    <main className="ui-page">
      <h1>Impostazioni</h1>
      <p className="ui-muted">Ogni campo si salva quando lo lasci.</p>

      <section className="ui-sec">
        <h2>Google Calendar</h2>
        <div className="set-grid">
          <TextSetting k="google.clientId" label="Client ID Google" placeholder="….apps.googleusercontent.com"
            help="Dalla Google Cloud Console (gratis). Resta su questo dispositivo." />
          <TextSetting k="calendar.workId" label="Calendario di lavoro" help="Dove l'app scrive le sessioni; primary = il calendario principale."
            check={(v) => (v ? undefined : 'scrivi un id di calendario (es. primary)')} />
          <TextSetting k="timeZone" label="Fuso orario" help="Es. Asia/Shanghai, Europe/Rome."
            check={(v) => (isValidTimeZone(v) ? undefined : `"${v}" non è un fuso orario riconosciuto`)} />
        </div>
        <ListSetting k="calendar.excluded" label="Calendari esclusi" placeholder="Un id di calendario per riga"
          help="Mai letti né modificati dall'app." />
      </section>

      <section className="ui-sec">
        <h2>Pianificazione</h2>
        <div className="set-grid">
          <TextSetting k="study.windowStart" type="time" label="Inizio finestra di studio" check={checkStart} />
          <TextSetting k="study.windowEnd" type="time" label="Fine finestra di studio" check={checkEnd} />
          <NumberSetting k="study.marginMin" min={0} max={120} label="Margine tra eventi (min)" />
          <NumberSetting k="study.minBlockMin" min={5} max={240} label="Blocco minimo (min)" help="Spazio libero più corto in cui spostare una sessione." />
          <NumberSetting k="stime.minSessions" min={1} max={100} label="Soglia sessioni per il fattore" help="Sessioni registrate prima di correggere le stime dei tempi." />
          <NumberSetting k="reminder.popupMin" min={0} max={240} label="Promemoria popup (min prima)" />
          <NumberSetting k="fsrs.retention" min={0.7} max={0.97} step="0.01" label="Ritenzione desiderata flashcard" help="0,9 = ricordare il 90% delle carte al ripasso." />
        </div>
      </section>

      <SubjectsEditor />
      <AiSettings />
      {children}
    </main>
  )
}
