/**
 * Облачная копия листов по Telegram-аккаунту.
 * Работает, когда сайт открыт из бота клуба: Telegram подтверждает, кто игрок, и листы
 * сохраняются на сервер клуба. Сменил телефон или открыл с другого устройства — листы на месте.
 * Без Telegram сайт работает как раньше, только на этом устройстве.
 */
import type { Sheet } from './model';
import { sheetName } from './model';
import { inTelegram } from './tgBack';

type TgWin = { Telegram?: { WebApp?: { initData?: string } } };
let base: string | null = null;

/** Подпись Telegram: из SDK или из того, что Telegram передал при открытии мини-приложения. */
function initData(): string {
  const w = window as unknown as TgWin;
  if (w.Telegram?.WebApp?.initData) return w.Telegram.WebApp.initData;
  try { const dev = localStorage.getItem('dev-init'); if (dev) return dev; } catch { /* */ }
  try { const p = JSON.parse(sessionStorage.getItem('__telegram__initParams') ?? '{}') as { tgWebAppData?: string }; if (p.tgWebAppData) return p.tgWebAppData; } catch { /* */ }
  return '';
}
async function apiBase(): Promise<string> {
  if (base !== null) return base;
  try { const o = localStorage.getItem('api-override'); if (o) return (base = o.replace(/\/$/, '')); } catch { /* */ }
  try { const c = await (await fetch(`${import.meta.env.BASE_URL}app-config.json`, { cache: 'no-cache' })).json() as { api?: string }; base = (c.api ?? '').replace(/\/$/, ''); } catch { base = ''; }
  return base;
}
/** Ждём, пока SDK Telegram подхватит данные (он грузится отдельно). */
async function ready(): Promise<string> {
  if (!inTelegram() && !initData()) return '';
  for (let i = 0; i < 20 && !initData(); i++) await new Promise((r) => setTimeout(r, 150));
  return initData();
}
export const cloudOn = () => !!initData();

async function call(method: string, path: string, body?: string): Promise<Response | null> {
  const auth = await ready(); const api = await apiBase();
  if (!auth || !api) return null;
  try { return await fetch(api + path, { method, headers: { 'content-type': 'application/json', 'x-init-data': auth }, body }); } catch { return null; }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Отправить лист в облако (с паузой, чтобы не слать на каждую букву). */
export function cloudPush(s: Sheet, delay = 2500) {
  if (!cloudOn()) return;
  clearTimeout(timers.get(s.id));
  timers.set(s.id, setTimeout(() => { timers.delete(s.id); void putSheet(s); }, delay));
}
async function putSheet(s: Sheet) {
  let body = JSON.stringify(s);
  if (body.length > 1_700_000) body = JSON.stringify(stripBig(s)); // огромный портрет — без него
  await call('PUT', `/api/sheets/${s.id}?name=${encodeURIComponent(sheetName(s))}`, body);
}
const stripBig = (s: Sheet): Sheet => ({ ...s, emblem: s.emblem?.startsWith('data:') ? undefined : s.emblem, pages: s.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.type === 'image' && (b.value?.length ?? 0) > 200_000 ? { ...b, value: '' } : b)) })) });
export function cloudDelete(id: string) { if (cloudOn()) void call('DELETE', `/api/sheets/${id}`); }

/**
 * Сверка при запуске: чего нет на устройстве или что новее в облаке — скачиваем,
 * что новее на устройстве или ещё не в облаке — отправляем.
 */
export async function cloudSync(local: { id: string; updatedAt: number }[], load: (id: string) => Promise<Sheet | undefined>, save: (s: Sheet) => Promise<void>): Promise<number> {
  const r = await call('GET', '/api/sheets');
  if (!r?.ok) return 0;
  const remote = (await r.json() as { sheets: { id: string; updated_at: number }[] }).sheets;
  const byId = new Map(local.map((m) => [m.id, m]));
  let pulled = 0;
  for (const x of remote) {
    const mine = byId.get(x.id);
    if (mine && mine.updatedAt >= x.updated_at) continue;
    const g = await call('GET', `/api/sheets/${x.id}`);
    if (g?.ok) { await save(await g.json() as Sheet); pulled++; }
  }
  const remoteIds = new Map(remote.map((x) => [x.id, x.updated_at]));
  for (const m of local) if ((remoteIds.get(m.id) ?? -1) < m.updatedAt) { const s = await load(m.id); if (s) await putSheet(s); }
  return pulled;
}
