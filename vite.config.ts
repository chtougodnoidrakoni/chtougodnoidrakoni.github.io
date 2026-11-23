import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const BUILD = String(Date.now());
/** version.json рядом с сайтом: телефон сверяет его со своей копией и обновляется, если отстал */
const versionFile = { name: 'version-file', generateBundle(this: { emitFile: (f: object) => void }) { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ v: BUILD }) }); } };

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  define: { __BUILD__: JSON.stringify(BUILD) },
  // два сайта клуба из одного кода: лист персонажа (/) и сборка персонажа (/builder/)
  build: { rollupOptions: { input: { main: 'index.html', builder: 'builder/index.html' } } },
  plugins: [
    react(), tailwindcss(), versionFile,
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*'],
      manifest: {
        name: 'Что угодно и драконы — лист персонажа', short_name: 'Лист ЧУиД', lang: 'ru',
        description: 'Конструктор листа персонажа D&D в стиле клуба «Что угодно и драконы»',
        theme_color: '#2b322d', background_color: '#2b322d', display: 'standalone',
        icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
      },
      workbox: { skipWaiting: true, clientsClaim: true, cleanupOutdatedCaches: true, globPatterns: ['**/*.{js,css,html,woff2,svg,png,webp,json}'], globIgnores: ['version.json'], navigateFallbackDenylist: [/version\.json/, /\/builder/], maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
    }),
  ],
});
