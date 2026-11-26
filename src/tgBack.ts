/**
 * Возврат в Telegram-приложение клуба. Если сайт открыли из мини-приложения (?tg=1),
 * запоминаем это на всю вкладку и показываем кнопку «Назад»: родную телеграмовскую
 * в шапке и свою полоску «← Назад в «Игры»» над страницей.
 */
const KEY = 'from-tg';
const APP = `${import.meta.env.BASE_URL.replace(/app\/?$/, '')}app/`;

export function fromTg(): boolean {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('tg') === '1') {
      sessionStorage.setItem(KEY, '1');
      q.delete('tg');
      const s = q.toString();
      history.replaceState(history.state, '', location.pathname + (s ? `?${s}` : '') + location.hash);
    }
    return sessionStorage.getItem(KEY) === '1';
  } catch { return false; }
}

export function setupTgBack() {
  if (!fromTg()) return;
  const back = () => { location.href = APP; };

  const bar = document.createElement('div');
  Object.assign(bar.style, {
    padding: 'max(8px, env(safe-area-inset-top)) 12px 8px', background: 'rgba(16,22,19,.96)',
    borderBottom: '1px solid rgba(214,190,140,.25)', display: 'flex', alignItems: 'center',
  } as Partial<CSSStyleDeclaration>);
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = '← Назад в «Игры»';
  b.setAttribute('aria-label', 'Назад в приложение клуба');
  Object.assign(b.style, {
    height: '36px', padding: '0 14px', borderRadius: '999px', border: '1px solid rgba(214,190,140,.6)',
    background: 'transparent', color: '#f0dfb8', font: '600 14px/1 system-ui, sans-serif',
  } as Partial<CSSStyleDeclaration>);
  b.addEventListener('click', back);
  bar.appendChild(b);
  const add = () => document.body.prepend(bar);
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);

  // родная кнопка «Назад» в шапке Telegram
  const s = document.createElement('script');
  s.src = 'https://telegram.org/js/telegram-web-app.js';
  s.async = true;
  s.onload = () => {
    const w = (window as unknown as { Telegram?: { WebApp?: { platform?: string; BackButton?: { show(): void; onClick(f: () => void): void } } } }).Telegram?.WebApp;
    if (!w?.BackButton || !w.platform || w.platform === 'unknown') return;
    w.BackButton.show();
    w.BackButton.onClick(back);
  };
  document.head.appendChild(s);
}

/* ---------- внутри Telegram файлы не скачиваются: уводим в обычный браузер ---------- */
type TgWin = { Telegram?: { WebApp?: { platform?: string; openLink?(u: string): void; openTelegramLink?(u: string): void } }; TelegramWebviewProxy?: { postEvent(e: string, d: string): void } };
const tw = () => window as unknown as TgWin;
/** Сайт открыт во встроенном окне Telegram (мини-приложение или ссылка из чата). */
export const inTelegram = () => fromTg() || !!tw().TelegramWebviewProxy || /Telegram/i.test(navigator.userAgent);
/** Открыть адрес в обычном браузере телефона или компьютера. */
export function openExternal(url: string) {
  const w = tw();
  if (w.Telegram?.WebApp?.openLink && w.Telegram.WebApp.platform && w.Telegram.WebApp.platform !== 'unknown') return w.Telegram.WebApp.openLink(url);
  if (w.TelegramWebviewProxy) return w.TelegramWebviewProxy.postEvent('web_app_open_link', JSON.stringify({ url }));
  window.open(url, '_blank');
}
/** Окно «Переслать» Telegram с готовой ссылкой. */
export function shareInTelegram(url: string, text: string): boolean {
  const w = tw(); const path = `/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (w.Telegram?.WebApp?.openTelegramLink && w.Telegram.WebApp.platform && w.Telegram.WebApp.platform !== 'unknown') { w.Telegram.WebApp.openTelegramLink(`https://t.me${path}`); return true; }
  if (w.TelegramWebviewProxy) { w.TelegramWebviewProxy.postEvent('web_app_open_tg_link', JSON.stringify({ path_full: path })); return true; }
  return false;
}
