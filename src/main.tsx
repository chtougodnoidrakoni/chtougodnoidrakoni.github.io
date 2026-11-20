import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// новая версия сайта подхватывается сама: проверяем при открытии и когда возвращаемся во вкладку
import { registerSW } from 'virtual:pwa-register';
const update = registerSW({ immediate: true, onRegisteredSW(_url, reg) {
  if (!reg) return;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void reg.update(); });
} });
void update;
