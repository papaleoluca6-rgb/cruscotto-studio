import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Sottocartella in cui gira l'app: "/" in locale, "/cruscotto-studio/" su GitHub Pages (la imposta il workflow).
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  // 127.0.0.1 esplicito: con "localhost" Vite su Windows ascolta solo su ::1 (IPv6)
  // e il port forwarding di chrome://inspect verso il telefono non lo raggiunge.
  server: { host: '127.0.0.1' },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': una versione nuova si applica solo quando l'utente tocca "Aggiorna".
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Cruscotto Studio',
        short_name: 'Cruscotto',
        description: 'Sessioni di studio da Google Calendar, pesi delle materie, esercizi e flashcard',
        lang: 'it',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0a0c13',
        theme_color: '#0a0c13',
        start_url: base,
        scope: base,
        id: base,
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
