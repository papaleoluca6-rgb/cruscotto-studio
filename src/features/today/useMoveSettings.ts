import type { Subject } from '../../db/schema'
import { getSetting, useSetting } from '../../db/settings'
import type { MoveOpts } from '../../lib/calendar/queueMove'
import type { SlotOpts } from '../../lib/planner/findSlot'

/** Impostazioni per cercare lo spazio e per mettere in coda Non fatto, Parziale e Imprevisto. */
export function useMoveSettings() {
  const tz = useSetting('timeZone')
  const windowStart = useSetting('study.windowStart')
  const windowEnd = useSetting('study.windowEnd')
  const marginMin = useSetting('study.marginMin')
  const minBlockMin = useSetting('study.minBlockMin')
  const slotOpts = (from: number): SlotOpts => ({ from, tz, windowStart, windowEnd, marginMin })
  const moveOpts = async (subjects: Pick<Subject, 'id' | 'prefix' | 'colorId'>[]): Promise<MoveOpts> => {
    const [workId, excluded, reminderMin] = await Promise.all([
      getSetting('calendar.workId'), getSetting('calendar.excluded'), getSetting('reminder.popupMin'),
    ])
    return { workId, excluded, reminderMin, subjects }
  }
  return { slotOpts, minBlockMin, moveOpts }
}
