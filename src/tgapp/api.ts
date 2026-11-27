import { initData } from './tg';

export interface Game {
  id: number; title: string; starts_at: string; duration_min: number; room: 'red' | 'green'; master_name: string; master_username: string;
  setting: string; system: string; level: string; price: string; seats: number; image_id: number | null; description: string;
  status: 'open' | 'cancelled'; taken: number; waiting: number; mine: 'main' | 'wait' | null;
}
export interface Player { name: string; status: 'main' | 'wait'; user_id?: number; username?: string; attended?: boolean }
export type Role = 'admin' | 'master' | 'player' | 'guest';

let base = '';
export async function loadConfig(): Promise<string> {
  const q = new URLSearchParams(location.search).get('api');
  if (q) { try { localStorage.setItem('api-override', q); } catch { /* */ } }
  let o = ''; try { o = localStorage.getItem('api-override') ?? ''; } catch { /* */ }
  if (o) return (base = o.replace(/\/$/, ''));
  try { const c = await (await fetch(`${import.meta.env.BASE_URL}app-config.json`, { cache: 'no-cache' })).json() as { api?: string }; base = (c.api ?? '').replace(/\/$/, ''); } catch { base = ''; }
  return base;
}
export const imgUrl = (id: number | null) => (id ? `${base}/img/${id}` : '');

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-init-data': initData() }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => ({ error: 'Сервер не ответил' }));
  if (!r.ok) throw new Error((data as { error?: string }).error ?? `Ошибка ${r.status}`);
  return data as T;
}
export const api = {
  me: () => req<{ user: { id: number; name: string; username: string } | null; role: Role; games?: Game[] }>('GET', '/api/me'),
  games: () => req<{ games: Game[] }>('GET', '/api/games'),
  game: (id: number) => req<{ game: Game; players: Player[]; canEdit: boolean }>('GET', `/api/games/${id}`),
  join: (id: number) => req<{ status: 'main' | 'wait'; position: number }>('POST', `/api/games/${id}/join`),
  leave: (id: number) => req('POST', `/api/games/${id}/leave`),
  create: (g: Partial<Game>) => req<{ id: number }>('POST', '/api/games', g),
  update: (id: number, g: Partial<Game>) => req('PUT', `/api/games/${id}`, g),
  act: (id: number, a: 'cancel' | 'reopen' | 'kick' | 'add' | 'attended', body?: unknown) => req('POST', `/api/games/${id}/${a}`, body ?? {}),
  image: (mime: string, data: string) => req<{ id: number }>('POST', '/api/images', { mime, data }),
  schedulePreview: (week: string) => req<{ week: string; text: string; count: number; posted: string | null }>('GET', `/api/schedule/preview?week=${week}`),
  schedulePost: (week: string, image_id: number) => req<{ ok: true; count: number }>('POST', '/api/schedule/post', { week, image_id }),
  sheets: () => req<{ sheets: { id: string; name: string; updated_at: number }[]; off: boolean }>('GET', '/api/sheets'),
  deleteSheets: () => req('DELETE', '/api/sheets'),
  sheetsOn: () => req('POST', '/api/sheets/on'),
  masters: () => req<{ masters: Master[] }>('GET', '/api/masters'),
  addMaster: (name: string, username: string) => req<{ masters: Master[] }>('POST', '/api/masters', { name, username }),
  removeMaster: (username: string) => req<{ masters: Master[] }>('DELETE', `/api/masters/${encodeURIComponent(username)}`),
};

export interface Master { name: string; username: string }
const TZ = 'Europe/Astrakhan';
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'long' });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
/** datetime-local (время Астрахани) ⇄ ISO с поясом +04:00 */
export const toIso = (local: string) => `${local}:00+04:00`;
export const toLocal = (iso: string) => { const d = new Date(Date.parse(iso) + 4 * 3600000); return d.toISOString().slice(0, 16); };
