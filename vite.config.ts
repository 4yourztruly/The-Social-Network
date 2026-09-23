import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves a project site (not a custom domain) from
// /<repo-name>/, not /. Only the CI deploy workflow sets GITHUB_PAGES, so
// local `npm run dev`/`build`/`preview` keep serving from / — and this
// stays a plain object (not defineConfig(fn=>...)) so vitest.config.ts can
// still mergeConfig() it; a callback form can't be merged.
const base = process.env.GITHUB_PAGES ? '/The-Social-Network/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Football Social Life Sim',
        short_name: 'FootySocial',
        description: 'A social-media life sim for a professional footballer.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'fullscreen',
        // Relative, not absolute — resolved against `base` above, so this
        // still works whether the app is served from / or /The-Social-Network/.
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico}'],
        // Explicit rather than relying on registerType:'autoUpdate' to
        // imply these — a new SW should take control immediately rather
        // than waiting for every tab to close first, and stale precache
        // entries from old builds should never linger once a new one has
        // activated.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
