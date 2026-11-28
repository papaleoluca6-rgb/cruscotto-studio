// Icone SVG a tratto (disegni di Lucide, licenza ISC, gratuita): niente emoji, stesso stile ovunque.
// Decorative di default (aria-hidden): il bottone che le contiene deve avere testo o aria-label.

const P = {
  calendar: 'M8 2v4|M16 2v4|M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z|M3 10h18',
  book: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z|M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z',
  pen: 'M12 20h9|M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.85Z',
  cards: 'M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z|M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2',
  settings: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z|M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  plus: 'M5 12h14|M12 5v14',
  trash: 'M3 6h18|M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6|M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|m17 8-5-5-5 5|M12 3v12',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|m7 10 5 5 5-5|M12 15V3',
  check: 'M20 6 9 17l-5-5',
  refresh: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8|M21 3v5h-5',
  x: 'M18 6 6 18|m6 6 12 12',
  undo: 'M3 7v6h6|M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z|M12 6v6l4 2',
  half: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z|M12 2v20',
  alert: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3|M12 9v4|M12 17h.01',
} as const

export type IconName = keyof typeof P

export function Icon({ name, size = 20, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {P[name].split('|').map((d) => <path key={d} d={d} />)}
    </svg>
  )
}
