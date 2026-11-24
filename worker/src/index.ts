// Сервер записей на игры клуба «Что угодно и драконы». Cloudflare Worker + база D1.
import { esc, telegramSender, verifyInitData, type Send, type TgUser } from './telegram';

// --- минимальное описание D1, чтобы не тянуть типы Cloudflare
export interface Stmt { bind(...v: unknown[]): Stmt; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes: number; last_row_id: number } }> }
export interface DB { prepare(sql: string): Stmt; batch(s: Stmt[]): Promise<unknown[]> }
export interface Env { DB: DB; BOT_TOKEN: string; ADMIN_USERNAMES?: string; APP_URL?: string; BOT_SECRET?: string; CHANNEL?: string }
export interface Ctx { waitUntil(p: Promise<unknown>): void }

type Role = 'admin' | 'master' | 'player';
interface Me { user: TgUser; role: Role; username: string; name: string }
export interface Game {
  id: number; title: string; starts_at: string; duration_min: number; room: string; master_name: string; master_username: string;
  setting: string; system: string; level: string; price: string; seats: number; image_id: number | null; description: string;
  status: string; created_by: string; created_at: string;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } });
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-init-data', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' };
const fail = (m: string, status = 400) => json({ error: m }, status);
const nameOf = (u: TgUser) => [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username || `Игрок ${u.id}`;
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { timeZone: 'Europe/Astrakhan', weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
};
const ended = (g: Pick<Game, 'starts_at' | 'duration_min'>, now: number) => Date.parse(g.starts_at) + g.duration_min * 60000 < now;
const started = (g: Pick<Game, 'starts_at'>, now: number) => Date.parse(g.starts_at) <= now;

async function me(req: Request, env: Env): Promise<Me | null> {
  const u = await verifyInitData(req.headers.get('x-init-data') ?? '', env.BOT_TOKEN);
  if (!u) return null;
  const username = (u.username ?? '').toLowerCase();
  const admins = (env.ADMIN_USERNAMES ?? '').toLowerCase().split(/[\s,]+/).map((x) => x.replace(/^@/, '')).filter(Boolean);
  let role: Role = 'player';
  if (username && admins.includes(username)) role = 'admin';
  else if (username) { const r = await env.DB.prepare('SELECT role FROM roles WHERE username = ?').bind(username).first<{ role: string }>(); if (r?.role === 'master') role = 'master'; }
  await env.DB.prepare('INSERT INTO users(id, name, username) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, username = excluded.username').bind(u.id, nameOf(u), username).run();
  return { user: u, role, username, name: nameOf(u) };
}
const canEdit = (m: Me | null, g: Game) => !!m && (m.role === 'admin' || (m.role === 'master' && (g.created_by === m.username || g.master_username.toLowerCase() === m.username)));

async function counts(env: Env, ids: number[]) {
  if (!ids.length) return new Map<number, { main: number; wait: number }>();
  const rows = (await env.DB.prepare(`SELECT game_id, status, COUNT(*) AS n FROM signups WHERE game_id IN (${ids.map(() => '?').join(',')}) GROUP BY game_id, status`).bind(...ids).all<{ game_id: number; status: string; n: number }>()).results;
  const m = new Map<number, { main: number; wait: number }>();
  for (const id of ids) m.set(id, { main: 0, wait: 0 });
  for (const r of rows) m.get(r.game_id)![r.status === 'main' ? 'main' : 'wait'] = r.n;
  return m;
}
async function myStatus(env: Env, uid: number | undefined, ids: number[]) {
  const m = new Map<number, string>();
  if (!uid || !ids.length) return m;
  const rows = (await env.DB.prepare(`SELECT game_id, status FROM signups WHERE user_id = ? AND game_id IN (${ids.map(() => '?').join(',')})`).bind(uid, ...ids).all<{ game_id: number; status: string }>()).results;
  for (const r of rows) m.set(r.game_id, r.status);
  return m;
}
const pub = (g: Game, c?: { main: number; wait: number }, mine?: string) => ({ ...g, taken: c?.main ?? 0, waiting: c?.wait ?? 0, mine: mine ?? null });

const FIELDS = ['title', 'starts_at', 'duration_min', 'room', 'master_name', 'master_username', 'setting', 'system', 'level', 'price', 'seats', 'image_id', 'description'] as const;
function clean(b: Record<string, unknown>, partial: boolean): { v?: Record<string, unknown>; error?: string } {
  const v: Record<string, unknown> = {};
  for (const k of FIELDS) {
    if (!(k in b)) continue;
    const x = b[k];
    if (k === 'duration_min' || k === 'seats') { const n = Number(x); if (!Number.isInteger(n) || n < 1 || n > (k === 'seats' ? 30 : 1440)) return { error: `${k === 'seats' ? 'Мест' : 'Длительность'}: неверное число` }; v[k] = n; }
    else if (k === 'image_id') v[k] = x === null || x === '' ? null : Number(x);
    else if (k === 'starts_at') { if (typeof x !== 'string' || Number.isNaN(Date.parse(x))) return { error: 'Неверная дата начала' }; v[k] = x; }
    else if (k === 'room') { if (x !== 'red' && x !== 'green') return { error: 'Комната: красная или зелёная' }; v[k] = x; }
    else v[k] = String(x ?? '').slice(0, k === 'description' ? 4000 : 200).trim();
  }
  if (typeof v.master_username === 'string') v.master_username = v.master_username.replace(/^@/, '').toLowerCase();
  if (!partial && (!v.title || !v.starts_at)) return { error: 'Нужны название и дата' };
  return { v };
}

async function notifyGame(env: Env, send: Send, gameId: number, text: string, only?: string) {
  const rows = (await env.DB.prepare(`SELECT user_id FROM signups WHERE game_id = ? ${only ? 'AND status = ?' : ''} AND user_id > 0`).bind(...(only ? [gameId, only] : [gameId])).all<{ user_id: number }>()).results;
  await Promise.all(rows.map((r) => send(r.user_id, text)));
}
async function notifyMaster(env: Env, send: Send, g: Game, text: string) {
  if (!g.master_username) return;
  const u = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(g.master_username.toLowerCase()).first<{ id: number }>();
  if (u) await send(u.id, text);
}
const openBtn = (env: Env, gameId?: number) => (env.APP_URL ? { reply_markup: { inline_keyboard: [[{ text: '🐉 Открыть приложение', web_app: { url: env.APP_URL + (gameId ? `#game/${gameId}` : '') } }]] } } : {});

/** Освобождает место: если в очереди кто-то есть и места хватает — переводит первого в основной состав. */
async function promote(env: Env, gameId: number): Promise<{ user_id: number; name: string } | null> {
  const g = await env.DB.prepare('SELECT seats FROM games WHERE id = ?').bind(gameId).first<{ seats: number }>();
  if (!g) return null;
  const next = await env.DB.prepare(`UPDATE signups SET status = 'main' WHERE id = (SELECT id FROM signups WHERE game_id = ?1 AND status = 'wait' ORDER BY created_at, id LIMIT 1)
    AND (SELECT COUNT(*) FROM signups WHERE game_id = ?1 AND status = 'main') < ?2 RETURNING user_id, name`).bind(gameId, g.seats).first<{ user_id: number; name: string }>();
  return next ?? null;
}

export async function handle(req: Request, env: Env, ctx: Ctx, send: Send = telegramSender(env.BOT_TOKEN), now = Date.now()): Promise<Response> {
  const url = new URL(req.url); const path = url.pathname.replace(/\/+$/, '') || '/';
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const later = (p: Promise<unknown>) => ctx.waitUntil(p.catch(() => {}));
  try {
    // ---------- бот
    if (path.startsWith('/bot/')) {
      if (!env.BOT_SECRET || path !== `/bot/${env.BOT_SECRET}`) return fail('нет доступа', 403);
      const upd = await req.json() as { message?: { chat: { id: number }; text?: string; from?: TgUser } };
      const m = upd.message; if (!m?.text) return json({ ok: true });
      if (m.from) await env.DB.prepare('INSERT INTO users(id, name, username, started) VALUES (?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET started = 1, name = excluded.name, username = excluded.username').bind(m.from.id, nameOf(m.from), (m.from.username ?? '').toLowerCase()).run();
      if (m.text.startsWith('/start')) later(send(m.chat.id, 'Привет! Это бот клуба «Что угодно и драконы» 🐉\n\nЗдесь ближайшие игры — записывайтесь, пока есть места. Я напомню о игре заранее.', openBtn(env)));
      else if (m.text.startsWith('/id')) later(send(m.chat.id, `Ваш id: <code>${m.chat.id}</code>${m.from?.username ? `, username: @${esc(m.from.username)}` : ''}`));
      else later(send(m.chat.id, 'Все игры и запись — в приложении:', openBtn(env)));
      return json({ ok: true });
    }
    // ---------- картинки
    const img = path.match(/^\/img\/(\d+)$/);
    if (img && req.method === 'GET') {
      const r = await env.DB.prepare('SELECT mime, data FROM images WHERE id = ?').bind(Number(img[1])).first<{ mime: string; data: string }>();
      if (!r) return fail('нет картинки', 404);
      const bin = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0));
      return new Response(bin, { headers: { 'content-type': r.mime, 'cache-control': 'public, max-age=31536000, immutable', ...CORS } });
    }
    if (!path.startsWith('/api/')) return json({ ok: true, service: 'chd-games' });
    const m = await me(req, env);
    const need = () => (m ? null : fail('Откройте приложение из Telegram, чтобы записаться', 401));
    const staff = () => (m && (m.role === 'admin' || m.role === 'master') ? null : fail('Только для мастеров и администратора', 403));

    if (path === '/api/me' && req.method === 'GET') {
      if (!m) return json({ user: null, role: 'guest' });
      const rows = (await env.DB.prepare(`SELECT g.*, s.status AS my FROM signups s JOIN games g ON g.id = s.game_id WHERE s.user_id = ? ORDER BY g.starts_at`).bind(m.user.id).all<Game & { my: string }>()).results.filter((g) => !ended(g, now));
      const c = await counts(env, rows.map((g) => g.id));
      return json({ user: { id: m.user.id, name: m.name, username: m.username }, role: m.role, games: rows.map((g) => pub(g, c.get(g.id), g.my)) });
    }
    if (path === '/api/games' && req.method === 'GET') {
      const rows = (await env.DB.prepare('SELECT * FROM games ORDER BY starts_at').all<Game>()).results.filter((g) => !ended(g, now) && (g.status === 'open' || Date.parse(g.starts_at) - now < 3 * 86400000));
      const ids = rows.map((g) => g.id); const c = await counts(env, ids); const my = await myStatus(env, m?.user.id, ids);
      return json({ games: rows.map((g) => pub(g, c.get(g.id), my.get(g.id))) });
    }
    if (path === '/api/games' && req.method === 'POST') {
      const no = need() ?? staff(); if (no) return no;
      const { v, error } = clean(await req.json() as Record<string, unknown>, false); if (error) return fail(error);
      if (m!.role === 'master' && !v!.master_username) { v!.master_username = m!.username; v!.master_name ||= m!.name; }
      const keys = Object.keys(v!);
      const r = await env.DB.prepare(`INSERT INTO games(${keys.join(', ')}, created_by, created_at) VALUES (${keys.map(() => '?').join(', ')}, ?, ?)`).bind(...keys.map((k) => v![k]), m!.username, new Date(now).toISOString()).run();
      return json({ id: r.meta.last_row_id });
    }
    const gm = path.match(/^\/api\/games\/(\d+)(?:\/(\w+))?$/);
    if (gm) {
      const id = Number(gm[1]); const act = gm[2];
      const g = await env.DB.prepare('SELECT * FROM games WHERE id = ?').bind(id).first<Game>();
      if (!g) return fail('Игра не найдена', 404);
      if (!act && req.method === 'GET') {
        const list = (await env.DB.prepare('SELECT user_id, name, username, status, attended FROM signups WHERE game_id = ? ORDER BY status, created_at, id').bind(id).all<{ user_id: number; name: string; username: string; status: string; attended: number }>()).results;
        const edit = canEdit(m, g);
        const c = await counts(env, [id]); const my = await myStatus(env, m?.user.id, [id]);
        return json({ game: pub(g, c.get(id), my.get(id)), players: list.map((p) => ({ name: p.name, status: p.status, ...(edit ? { user_id: p.user_id, username: p.username, attended: !!p.attended } : {}) })), canEdit: edit });
      }
      if (act === 'join' && req.method === 'POST') {
        const no = need(); if (no) return no;
        if (g.status !== 'open') return fail('Игра отменена');
        if (started(g, now)) return fail('Игра уже началась');
        // одним запросом: место в основном составе, если оно есть, иначе очередь — без гонки за последнее место
        const r = await env.DB.prepare(`INSERT INTO signups(game_id, user_id, name, username, status, created_at)
          SELECT ?1, ?2, ?3, ?4, CASE WHEN (SELECT COUNT(*) FROM signups WHERE game_id = ?1 AND status = 'main') < (SELECT seats FROM games WHERE id = ?1) THEN 'main' ELSE 'wait' END, ?5
          WHERE true ON CONFLICT(game_id, user_id) DO NOTHING RETURNING status`).bind(id, m!.user.id, m!.name, m!.username, new Date(now).toISOString()).first<{ status: string }>();
        if (!r) return fail('Вы уже записаны на эту игру');
        const pos = r.status === 'wait' ? (await env.DB.prepare(`SELECT COUNT(*) AS n FROM signups WHERE game_id = ? AND status = 'wait'`).bind(id).first<{ n: number }>())!.n : 0;
        later(send(m!.user.id, r.status === 'main'
          ? `✅ Вы записаны на «${esc(g.title)}»\n${fmtDate(g.starts_at)} · ${g.room === 'green' ? 'зелёная' : 'красная'} комната${g.master_name ? `\nМастер: ${esc(g.master_name)}` : ''}\n\nНапомню за день и за пару часов до игры.`
          : `🕯 Мест на «${esc(g.title)}» нет — вы в листе ожидания, место ${pos}. Если кто-то откажется, я сразу напишу.`, openBtn(env, id)));
        later(notifyMaster(env, send, g, `${r.status === 'main' ? '➕' : '🕯'} ${esc(m!.name)}${m!.username ? ` (@${esc(m!.username)})` : ''} ${r.status === 'main' ? 'записался' : 'встал в очередь'} на «${esc(g.title)}»`));
        return json({ status: r.status, position: pos });
      }
      if (act === 'leave' && req.method === 'POST') {
        const no = need(); if (no) return no;
        if (started(g, now)) return fail('Игра уже началась');
        const r = await env.DB.prepare('DELETE FROM signups WHERE game_id = ? AND user_id = ? RETURNING status').bind(id, m!.user.id).first<{ status: string }>();
        if (!r) return fail('Вы не записаны');
        if (r.status === 'main') {
          const p = await promote(env, id);
          if (p && p.user_id > 0) later(send(p.user_id, `🎉 Освободилось место — вы записаны на «${esc(g.title)}»!\n${fmtDate(g.starts_at)}`, openBtn(env, id)));
          later(notifyMaster(env, send, g, `➖ ${esc(m!.name)} отменил запись на «${esc(g.title)}»${p ? `, место занял ${esc(p.name)}` : ''}`));
        }
        return json({ ok: true });
      }
      // ---------- управление игрой
      if (!canEdit(m, g)) return fail('Нет прав на эту игру', 403);
      if (!act && req.method === 'PUT') {
        const { v, error } = clean(await req.json() as Record<string, unknown>, true); if (error) return fail(error);
        const keys = Object.keys(v!); if (!keys.length) return json({ ok: true });
        await env.DB.prepare(`UPDATE games SET ${keys.map((k) => `${k} = ?`).join(', ')}${'starts_at' in v! ? ', reminded_day = 0, reminded_soon = 0' : ''} WHERE id = ?`).bind(...keys.map((k) => v![k]), id).run();
        // мест стало больше — подтягиваем очередь
        if ('seats' in v!) for (let i = 0; i < 30; i++) { const p = await promote(env, id); if (!p) break; if (p.user_id > 0) later(send(p.user_id, `🎉 Добавили места — вы записаны на «${esc(g.title)}»!`, openBtn(env, id))); }
        if ('starts_at' in v! && v!.starts_at !== g.starts_at) later(notifyGame(env, send, id, `📅 Игра «${esc(g.title)}» перенесена: ${fmtDate(String(v!.starts_at))}`));
        return json({ ok: true });
      }
      if (act === 'cancel' && req.method === 'POST') {
        await env.DB.prepare(`UPDATE games SET status = 'cancelled' WHERE id = ?`).bind(id).run();
        later(notifyGame(env, send, id, `❌ Игра «${esc(g.title)}» (${fmtDate(g.starts_at)}) отменена. Простите — следите за новыми играми в приложении.`));
        return json({ ok: true });
      }
      if (act === 'reopen' && req.method === 'POST') { await env.DB.prepare(`UPDATE games SET status = 'open' WHERE id = ?`).bind(id).run(); return json({ ok: true }); }
      if (act === 'kick' && req.method === 'POST') {
        const { user_id } = await req.json() as { user_id: number };
        const r = await env.DB.prepare('DELETE FROM signups WHERE game_id = ? AND user_id = ? RETURNING status').bind(id, user_id).first<{ status: string }>();
        if (r?.status === 'main') { const p = await promote(env, id); if (p && p.user_id > 0) later(send(p.user_id, `🎉 Освободилось место — вы записаны на «${esc(g.title)}»!`, openBtn(env, id))); }
        return json({ ok: true });
      }
      if (act === 'add' && req.method === 'POST') {
        const { name } = await req.json() as { name: string };
        if (!name?.trim()) return fail('Нужно имя');
        const r = await env.DB.prepare(`INSERT INTO signups(game_id, user_id, name, status, created_at)
          SELECT ?1, ?2, ?3, CASE WHEN (SELECT COUNT(*) FROM signups WHERE game_id = ?1 AND status = 'main') < (SELECT seats FROM games WHERE id = ?1) THEN 'main' ELSE 'wait' END, ?4 RETURNING status`).bind(id, -now - Math.floor(Math.random() * 1000), name.trim().slice(0, 80), new Date(now).toISOString()).first<{ status: string }>();
        return json({ status: r?.status });
      }
      if (act === 'attended' && req.method === 'POST') {
        const { user_id, value } = await req.json() as { user_id: number; value: boolean };
        await env.DB.prepare('UPDATE signups SET attended = ? WHERE game_id = ? AND user_id = ?').bind(value ? 1 : 0, id, user_id).run();
        return json({ ok: true });
      }
      return fail('Неизвестное действие', 404);
    }
    if (path === '/api/images' && req.method === 'POST') {
      const no = need() ?? staff(); if (no) return no;
      const { mime, data } = await req.json() as { mime: string; data: string };
      if (!/^image\/(jpeg|png|webp)$/.test(mime) || typeof data !== 'string') return fail('Нужна картинка JPEG, PNG или WebP');
      if (data.length > 1_400_000) return fail('Картинка слишком большая — до 1 МБ');
      const r = await env.DB.prepare('INSERT INTO images(mime, data) VALUES (?, ?)').bind(mime, data).run();
      return json({ id: r.meta.last_row_id });
    }
    if (path === '/api/roles') {
      if (m?.role !== 'admin') return fail('Только для администратора', 403);
      if (req.method === 'GET') return json({ roles: (await env.DB.prepare('SELECT username, role FROM roles ORDER BY username').all()).results });
      const { username, role } = await req.json() as { username: string; role: string | null };
      const u = String(username ?? '').replace(/^@/, '').toLowerCase().trim();
      if (!/^[a-z0-9_]{3,32}$/.test(u)) return fail('Неверный username');
      if (role === 'master') await env.DB.prepare(`INSERT INTO roles(username, role) VALUES (?, 'master') ON CONFLICT(username) DO UPDATE SET role = 'master'`).bind(u).run();
      else await env.DB.prepare('DELETE FROM roles WHERE username = ?').bind(u).run();
      return json({ ok: true });
    }
    return fail('Не найдено', 404);
  } catch (e) {
    return fail(`Ошибка сервера: ${(e as Error).message}`, 500);
  }
}

/** Напоминания: за сутки и за два часа до начала. Запускается по расписанию раз в 15 минут. */
export async function remind(env: Env, send: Send = telegramSender(env.BOT_TOKEN), now = Date.now()) {
  const games = (await env.DB.prepare(`SELECT * FROM games WHERE status = 'open' AND (reminded_day = 0 OR reminded_soon = 0)`).all<Game & { reminded_day: number; reminded_soon: number }>()).results;
  for (const g of games) {
    const left = Date.parse(g.starts_at) - now;
    if (left <= 0) continue;
    if (!g.reminded_soon && left <= 2.5 * 3600000) {
      await env.DB.prepare('UPDATE games SET reminded_soon = 1, reminded_day = 1 WHERE id = ?').bind(g.id).run();
      await notifyGame(env, send, g.id, `⏳ Скоро игра «${esc(g.title)}» — ${fmtDate(g.starts_at)}, ${g.room === 'green' ? 'зелёная' : 'красная'} комната. Ждём вас!`, 'main');
    } else if (!g.reminded_day && left <= 26 * 3600000 && left > 2.5 * 3600000) {
      await env.DB.prepare('UPDATE games SET reminded_day = 1 WHERE id = ?').bind(g.id).run();
      await notifyGame(env, send, g.id, `🐉 Завтра игра «${esc(g.title)}» — ${fmtDate(g.starts_at)}. Если не сможете прийти, отмените запись в приложении: место ждут другие.`, 'main');
    }
  }
}

export default {
  fetch: (req: Request, env: Env, ctx: Ctx) => handle(req, env, ctx),
  scheduled: (_e: unknown, env: Env, ctx: Ctx) => ctx.waitUntil(remind(env)),
};
