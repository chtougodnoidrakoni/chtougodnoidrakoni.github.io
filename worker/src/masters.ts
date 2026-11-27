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

export function masters(env: Env): Master[] {
  return (env.MASTERS ?? '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
    const [name, user] = x.split(':');
    return { name: (name ?? '').trim(), username: (user ?? '').trim().replace(/^@/, '').toLowerCase() };
  }).filter((m) => m.name && m.username);
}
export const masterOf = (env: Env, username?: string) => (username ? masters(env).find((m) => m.username === username.toLowerCase()) : undefined);

const listed = (s: string | undefined, username?: string) => !!username && (s ?? '').toLowerCase().split(/[\s,]+/).map((x) => x.replace(/^@/, '')).includes(username.toLowerCase());
export const isAdmin = (env: Env, username?: string) => listed(env.ADMIN_USERNAMES, username);

/** Нижняя клавиатура бота: админу — расписание, мастеру — его игры. */
export function keyboardFor(env: Env, username?: string) {
  const row = [...(isAdmin(env, username) ? [{ text: SCHEDULE_BTN }] : []), ...(masterOf(env, username) ? [{ text: MASTER_BTN }] : [])];
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

type Upd = { message?: { chat: { id: number }; text?: string; from?: TgUser }; callback_query?: { id: string; from: TgUser; data?: string; message?: { chat: { id: number } } } };

/** true — это была кнопка мастера, ответили. */
export async function masterBot(env: Env, upd: Upd, send: Send, now: number): Promise<boolean> {
  const cq = upd.callback_query; const msg = upd.message;
  const from = cq?.from ?? msg?.from; const chat = cq?.message?.chat.id ?? msg?.chat.id;
  const text = msg?.text?.trim() ?? ''; const cb = cq?.data ?? '';
  if (!from || !chat || !(text === MASTER_BTN || text.startsWith('/mygames') || cb.startsWith('mg:'))) return false;
  const m = masterOf(env, from.username);
  if (cq) await tgApi(env.BOT_TOKEN)('answerCallbackQuery', { callback_query_id: cq.id }).catch(() => undefined);
  if (!m) { await send(chat, 'Этот раздел для мастеров клуба. Если вы ведёте игры, напишите администратору, чтобы вас добавили.'); return true; }
  const app = (id?: number) => (env.APP_URL ? [{ text: '🐉 Открыть в приложении', web_app: { url: env.APP_URL + (id ? `#game/${id}` : '') } }] : []);

  if (cb.startsWith('mg:')) {
    const id = Number(cb.slice(3));
    const g = (await gamesOf(env, m, now)).find((x) => x.id === id);
    if (!g) { await send(chat, 'Эта игра уже прошла или вас на ней больше нет.'); return true; }
    const ps = (await env.DB.prepare(`SELECT COALESCE(u.name, s.name) AS name, u.username, s.status FROM signups s LEFT JOIN users u ON u.id = s.user_id AND s.user_id > 0
      WHERE s.game_id = ? AND s.status IN ('main', 'wait') ORDER BY s.created_at, s.id`).bind(id).all<{ name: string; username: string | null; status: string }>()).results;
    const line = (p: { name: string; username: string | null }, i: number) => `${i + 1}. ${esc(p.name || 'Игрок')}${p.username && !p.name.includes('@') ? ` @${esc(p.username)}` : ''}`;
    const main = ps.filter((p) => p.status === 'main'), wait = ps.filter((p) => p.status === 'wait');
    await send(chat, `<b>${esc(g.title)}</b>\n${when(g.starts_at)} · ${roomOf(g.room)}\n\n👥 Игроки: ${main.length} из ${g.seats}\n${main.length ? main.map(line).join('\n') : 'пока никто не записался'}${wait.length ? `\n\n⏳ В очереди:\n${wait.map(line).join('\n')}` : ''}`,
      { reply_markup: { inline_keyboard: [app(id)].filter((r) => r.length) } });
    return true;
  }

  const gs = await gamesOf(env, m, now);
  if (!gs.length) { await send(chat, `${esc(m.name)}, у вас пока нет запланированных игр. Как только админ поставит вас мастером, игра появится здесь.`, keyboardFor(env, from.username)); return true; }
  const body = gs.map((g) => `<b>${when(g.starts_at)}</b> · ${roomOf(g.room)}\n${esc(g.title)}\nЗаписались ${g.taken} из ${g.seats}${g.waiting ? `, в очереди ${g.waiting}` : ''}`).join('\n\n');
  await send(chat, `🎲 ${esc(m.name)}, ваши игры:\n\n${body}\n\nНажмите на игру, чтобы увидеть игроков.`,
    { reply_markup: { inline_keyboard: gs.slice(0, 20).map((g) => [{ text: `${when(g.starts_at)} · ${g.title}`.slice(0, 60), callback_data: `mg:${g.id}` }]) } });
  return true;
}
