/**
 * Мастера клуба. Список — в переменной MASTERS (wrangler.toml): «Имя:ник, Имя:ник».
 * Админ в мастере расписания выбирает мастера кнопкой, а сам мастер в боте жмёт «Игры, которые я веду».
 */
import { esc, type Send, type TgUser } from './telegram';
import type { Env } from './index';
import { tgApi } from './schedule';

export const MASTER_BTN = '🎲 Игры, которые я веду';
export const SCHEDULE_BTN = '📅 Составить расписание';
export interface Master { name: string; username: string }

const parseEnv = (env: Env): Master[] => (env.MASTERS ?? '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
  const [name, user] = x.split(':');
  return { name: (name ?? '').trim(), username: (user ?? '').trim().replace(/^@/, '').toLowerCase() };
}).filter((m) => m.name && m.username);

/** Первый раз переносим стартовый список из MASTERS в базу; дальше список правят админы в приложении. */
async function seed(env: Env) {
  const list = parseEnv(env); if (!list.length) return;
  const fresh = await env.DB.prepare("INSERT INTO meta(key, value) VALUES ('masters_seeded', '1') ON CONFLICT(key) DO NOTHING RETURNING key").first();
  if (!fresh) return;
  for (const m of list) await env.DB.prepare('INSERT INTO masters(username, name) VALUES (?, ?) ON CONFLICT(username) DO NOTHING').bind(m.username, m.name).run();
}
export async function masters(env: Env): Promise<Master[]> {
  await seed(env);
  return (await env.DB.prepare('SELECT name, username FROM masters ORDER BY rowid').all<Master>()).results;
}
export const masterOf = async (env: Env, username?: string) => (username ? (await masters(env)).find((m) => m.username === username.toLowerCase()) : undefined);
export const cleanUsername = (u: string) => u.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '').toLowerCase();
export async function addMaster(env: Env, name: string, username: string) {
  await seed(env);
  await env.DB.prepare('INSERT INTO masters(username, name) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET name = excluded.name').bind(username, name).run();
}
export async function removeMaster(env: Env, username: string) { await seed(env); await env.DB.prepare('DELETE FROM masters WHERE username = ?').bind(username).run(); }

const listed = (s: string | undefined, username?: string) => !!username && (s ?? '').toLowerCase().split(/[\s,]+/).map((x) => x.replace(/^@/, '')).includes(username.toLowerCase());
export const isAdmin = (env: Env, username?: string) => listed(env.ADMIN_USERNAMES, username);

/** Нижняя клавиатура бота: админу — расписание, мастеру — его игры. */
export async function keyboardFor(env: Env, username?: string) {
  const row = [...(isAdmin(env, username) ? [{ text: SCHEDULE_BTN }] : []), ...((await masterOf(env, username)) ? [{ text: MASTER_BTN }] : [])];
  return row.length ? { reply_markup: { keyboard: row.map((b) => [b]), resize_keyboard: true, is_persistent: true } } : {};
}

interface G { id: number; title: string; starts_at: string; room: string; seats: number; master_name: string; master_username: string; status: string; taken: number; waiting: number }
const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const when = (iso: string) => { const d = new Date(Date.parse(iso) + 4 * 3600_000); return `${WD[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const roomOf = (r: string) => (r === 'green' ? '🟩 Зелёная комната' : '🟥 Красная комната');

/** Ближайшие игры мастера: по нику, а у старых игр без ника — по имени. */
export async function gamesOf(env: Env, m: Master, now: number): Promise<G[]> {
  const rows = (await env.DB.prepare(`SELECT g.*, (SELECT COUNT(*) FROM signups s WHERE s.game_id = g.id AND s.status = 'main') AS taken,
    (SELECT COUNT(*) FROM signups s WHERE s.game_id = g.id AND s.status = 'wait') AS waiting
    FROM games g WHERE g.status != 'cancelled' AND (lower(g.master_username) = ?1 OR (g.master_username = '' AND lower(trim(g.master_name)) = ?2))`)
    .bind(m.username, m.name.toLowerCase()).all<G>()).results;
  return rows.filter((g) => Date.parse(g.starts_at) >= now - 4 * 3600_000).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

/** Карточка игры для мастера: когда, где, кто записан, кто в очереди. */
export async function gameCard(env: Env, g: G) {
  const ps = (await env.DB.prepare(`SELECT COALESCE(u.name, s.name) AS name, u.username, s.status FROM signups s LEFT JOIN users u ON u.id = s.user_id AND s.user_id > 0
    WHERE s.game_id = ? AND s.status IN ('main', 'wait') ORDER BY s.created_at, s.id`).bind(g.id).all<{ name: string; username: string | null; status: string }>()).results;
  const line = (p: { name: string; username: string | null }, i: number) => `${i + 1}. ${esc(p.name || 'Игрок')}${p.username && !(p.name ?? '').includes('@') ? ` @${esc(p.username)}` : ''}`;
  const main = ps.filter((p) => p.status === 'main'), wait = ps.filter((p) => p.status === 'wait');
  return `<b>${esc(g.title)}</b>\n${when(g.starts_at)} · ${roomOf(g.room)}\n\n👥 Игроки: ${main.length} из ${g.seats}\n${main.length ? main.map(line).join('\n') : 'пока никто не записался'}${wait.length ? `\n\n⏳ В очереди:\n${wait.map(line).join('\n')}` : ''}`;
}

/** Вечерняя сводка: каждому мастеру — его завтрашние игры со списком игроков. Раз в день, по расписанию. */
export async function masterDigest(env: Env, send: Send, now: number) {
  const tomorrow = new Date(now + 4 * 3600_000 + 864e5).toISOString().slice(0, 10);
  const fresh = await env.DB.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING RETURNING key').bind(`digest:${tomorrow}`, new Date(now).toISOString()).first();
  if (!fresh) return 0;
  let n = 0;
  for (const m of await masters(env)) {
    const gs = (await gamesOf(env, m, now)).filter((g) => new Date(Date.parse(g.starts_at) + 4 * 3600_000).toISOString().slice(0, 10) === tomorrow);
    if (!gs.length) continue;
    const u = await env.DB.prepare('SELECT id FROM users WHERE username = ? AND started = 1').bind(m.username).first<{ id: number }>();
    if (!u) continue;
    const cards = await Promise.all(gs.map((g) => gameCard(env, g)));
    await send(u.id, `🌙 ${esc(m.name)}, завтра ${gs.length > 1 ? 'ваши игры' : 'ваша игра'}:\n\n${cards.join('\n\n〰️〰️〰️\n\n')}`).catch(() => undefined);
    n++;
  }
  return n;
}

type Upd = { message?: { chat: { id: number }; text?: string; from?: TgUser }; callback_query?: { id: string; from: TgUser; data?: string; message?: { chat: { id: number } } } };

/** true — это была кнопка мастера, ответили. */
export async function masterBot(env: Env, upd: Upd, send: Send, now: number): Promise<boolean> {
  const cq = upd.callback_query; const msg = upd.message;
  const from = cq?.from ?? msg?.from; const chat = cq?.message?.chat.id ?? msg?.chat.id;
  const text = msg?.text?.trim() ?? ''; const cb = cq?.data ?? '';
  if (!from || !chat || !(text === MASTER_BTN || text.startsWith('/mygames') || cb.startsWith('mg:'))) return false;
  const m = await masterOf(env, from.username);
  if (cq) await tgApi(env.BOT_TOKEN)('answerCallbackQuery', { callback_query_id: cq.id }).catch(() => undefined);
  if (!m) { await send(chat, 'Этот раздел для мастеров клуба. Если вы ведёте игры, напишите администратору, чтобы вас добавили.'); return true; }
  const app = (id?: number) => (env.APP_URL ? [{ text: '🐉 Открыть в приложении', web_app: { url: env.APP_URL + (id ? `#game/${id}` : '') } }] : []);

  if (cb.startsWith('mg:')) {
    const id = Number(cb.slice(3));
    const g = (await gamesOf(env, m, now)).find((x) => x.id === id);
    if (!g) { await send(chat, 'Эта игра уже прошла или вас на ней больше нет.'); return true; }
    await send(chat, await gameCard(env, g),
      { reply_markup: { inline_keyboard: [app(id)].filter((r) => r.length) } });
    return true;
  }

  const gs = await gamesOf(env, m, now);
  if (!gs.length) { await send(chat, `${esc(m.name)}, у вас пока нет запланированных игр. Как только админ поставит вас мастером, игра появится здесь.`, await keyboardFor(env, from.username)); return true; }
  const body = gs.map((g) => `<b>${when(g.starts_at)}</b> · ${roomOf(g.room)}\n${esc(g.title)}\nЗаписались ${g.taken} из ${g.seats}${g.waiting ? `, в очереди ${g.waiting}` : ''}`).join('\n\n');
  await send(chat, `🎲 ${esc(m.name)}, ваши игры:\n\n${body}\n\nНажмите на игру, чтобы увидеть игроков.`,
    { reply_markup: { inline_keyboard: gs.slice(0, 20).map((g) => [{ text: `${when(g.starts_at)} · ${g.title}`.slice(0, 60), callback_data: `mg:${g.id}` }]) } });
  return true;
}
