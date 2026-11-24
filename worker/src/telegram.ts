// Проверка подписи Telegram WebApp (initData) и отправка сообщений ботом.
export interface TgUser { id: number; first_name: string; last_name?: string; username?: string }

const enc = new TextEncoder();
async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Возвращает пользователя, если подпись верна и данные не старше maxAge секунд. */
export async function verifyInitData(initData: string, botToken: string, maxAge = 86400 * 7, now = Date.now() / 1000): Promise<TgUser | null> {
  if (!initData || !botToken) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get('hash'); if (!hash) return null;
  p.delete('hash');
  const check = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = await hmac(enc.encode('WebAppData'), botToken);
  if (hex(await hmac(secret, check)) !== hash) return null;
  const auth = Number(p.get('auth_date') ?? 0);
  if (!auth || now - auth > maxAge) return null;
  try { const u = JSON.parse(p.get('user') ?? 'null') as TgUser | null; return u && typeof u.id === 'number' ? u : null; } catch { return null; }
}

/** Подписывает initData — нужно только тестам и локальной разработке. */
export async function signInitData(user: TgUser, botToken: string, authDate = Math.floor(Date.now() / 1000)): Promise<string> {
  const p = new URLSearchParams({ auth_date: String(authDate), user: JSON.stringify(user) });
  const check = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = await hmac(enc.encode('WebAppData'), botToken);
  p.set('hash', hex(await hmac(secret, check)));
  return p.toString();
}

export type Send = (chatId: number | string, text: string, extra?: Record<string, unknown>) => Promise<void>;
export const telegramSender = (token: string): Send => async (chatId, text, extra) => {
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }) });
  } catch { /* бот не смог написать — запись от этого не ломается */ }
};
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
