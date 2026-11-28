import { getSetting } from '../../db/settings'
import { HttpError } from '../http'
import { googleClient, type CalendarClient } from './api'
import { validToken } from './auth'
import { devFakeCalendar } from './fake'

export interface WorkClient { client: CalendarClient; tz: string; workId: string; excluded: string[]; fake: boolean }

/** Client del calendario di lavoro dalle impostazioni: finto solo in sviluppo e se scelto, altrimenti Google con il token in memoria. */
export async function workClient(): Promise<WorkClient> {
  const [workId, tz, excluded, fakeSetting] = await Promise.all([getSetting('calendar.workId'), getSetting('timeZone'), getSetting('calendar.excluded'), getSetting('dev.fakeCalendar')])
  const fake = import.meta.env.DEV && fakeSetting
  const client = fake ? devFakeCalendar(workId, tz, excluded) : googleClient({
    calendarId: workId, timeZone: tz, excluded,
    token: async () => validToken() ?? Promise.reject(new HttpError('http', 'HTTP 401: token scaduto durante la lettura', 401)),
  })
  return { client, tz, workId, excluded, fake }
}
