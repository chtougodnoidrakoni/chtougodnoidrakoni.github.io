import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(), tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*'],
      manifest: {
        name: 'Что угодно и драконы — лист персонажа', short_name: 'Лист ЧУиД', lang: 'ru',
        description: 'Конструктор листа персонажа D&D в стиле клуба «Что угодно и драконы»',
        theme_color: '#2b322d', background_color: '#2b322d', display: 'standalone',
        icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,woff2,svg,png,json}'], maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
    }),
  ],
});
