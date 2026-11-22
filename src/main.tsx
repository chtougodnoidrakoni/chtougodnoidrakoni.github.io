import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// новая версия сайта подхватывается сама: проверяем при открытии и когда возвращаемся во вкладку
import { registerSW } from 'virtual:pwa-register';

/** Перезагружаться можно только когда человек ничего не заполняет: на главной, без открытых окон и без фокуса в поле. */
function safeNow() {
  const a = document.activeElement;
  const typing = a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement;
  return !typing && !document.querySelector('.z-50') && !document.querySelector('.page');
}
let waiting = false;
function whenSafe(fn: () => void) {
  if (waiting) return; waiting = true;
  const tick = () => { if (safeNow()) fn(); else setTimeout(tick, 3000); };
  tick();
}
const update = registerSW({ immediate: true,
  onNeedRefresh() { whenSafe(() => void update(true)); },
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void reg.update(); });
  } });

declare const __BUILD__: string;
/**
 * Страховка от застрявшей старой версии (Safari любит держать её в памяти):
 * спрашиваем у сервера номер сборки и, если он новее, сбрасываем кэш и перезагружаемся.
 */
async function checkVersion() {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const { v } = await r.json();
    if (!v || v === __BUILD__ || sessionStorage.getItem('reloaded-for') === v) return;
    whenSafe(() => void hardReload(v));
  } catch { /* нет сети — живём на сохранённой версии */ }
}
async function hardReload(v: string) {
  try {
    sessionStorage.setItem('reloaded-for', v);
    const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
    await Promise.all(regs.map((x) => x.unregister()));
    if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    location.reload();
  } catch { /* нет сети — живём на сохранённой версии */ }
}
if (import.meta.env.PROD) {
  void checkVersion();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void checkVersion(); });
}
