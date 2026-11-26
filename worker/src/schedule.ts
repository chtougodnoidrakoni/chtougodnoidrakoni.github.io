/**
 * Расписание недели для канала клуба и напоминания администраторам.
 * Оформление поста — как в канале: цветной квадрат комнаты, день и время, сколько мест, мастер, приключение…
 */
import { esc, type Send } from './telegram';
import type { Env, Game } from './index';

const TZ_MS = 4 * 3600_000; // Астрахань, UTC+4 круглый год
const local = (ms: number) => new Date(ms + TZ_MS);
const DAYS = ['ВОСКРЕСЕНЬЕ', 'ПОНЕДЕЛЬНИК', 'ВТОРНИК', 'СРЕДА', 'ЧЕТВЕРГ', 'ПЯТНИЦА', 'СУББОТА'];
const pad = (n: number) => String(n).padStart(2, '0');
const plural = (n: number, a: string, b: string, c: string) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);

/** Понедельник недели (YYYY-MM-DD, по Астрахани) для момента времени. */
export function mondayOf(ms: number): string {
  const d = local(ms); const wd = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - wd)).toISOString().slice(0, 10);
}
const weekRange = (monday: string) => { const a = Date.parse(`${monday}T00:00:00+04:00`); return [new Date(a).toISOString(), new Date(a + 7 * 864e5).toISOString()] as const; };

/** Описание без служебных строк вроде «Запись также у …». */
const cleanDesc = (s: string) => s.split('\n').filter((l) => !/^\s*запись также/i.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();

export function gameBlock(g: Game, taken: number): string {
  const d = local(Date.parse(g.starts_at));
  const free = Math.max(0, g.seats - taken);
  const seats = free ? `осталось ${free} ${plural(free, 'место', 'места', 'мест')}` : 'мест нет';
  const row = (k: string, v?: string) => (v?.trim() ? `\n<b>${k}:</b> ${esc(v.trim())}` : '');
  const desc = cleanDesc(g.description);
  return `${g.room === 'green' ? '🟩' : '🟥'} <b>${DAYS[d.getUTCDay()]} (${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}), ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}</b> — <i>${seats}</i>`
    + row('Мастер', g.master_name) + row('Приключение', g.title) + (g.system && !/^d&d/i.test(g.system) ? row('Система', g.system) : '')
    + row('Сеттинг', g.setting) + row('Уровень', g.level) + (desc ? `\n<b>В двух словах:</b> ${esc(desc.length > 400 ? `${desc.slice(0, 397).trimEnd()}…` : desc)}` : '');
}

/** Части поста: первая (с картинкой) и, если всё не влезло в 4096 знаков, продолжения. */
export async function buildPost(env: Env, monday: string, intro = ''): Promise<{ parts: string[]; count: number }> {
  const [from, to] = weekRange(monday);
  const games = (await env.DB.prepare(`SELECT g.*, (SELECT COUNT(*) FROM signups s WHERE s.game_id = g.id AND s.status = 'main') AS taken FROM games g
    WHERE g.status = 'open' AND g.starts_at >= ? AND g.starts_at < ? ORDER BY g.starts_at, CASE g.room WHEN 'red' THEN 0 ELSE 1 END`).bind(monday, new Date(Date.parse(to) + 2 * 864e5).toISOString().slice(0, 10)).all<Game & { taken: number }>()).results
    // в базе время с поясом +04:00: SQL берёт с запасом по дате, точно отсекаем по времени
    .filter((g) => Date.parse(g.starts_at) >= Date.parse(from) && Date.parse(g.starts_at) < Date.parse(to));
  const a = local(Date.parse(from)); const z = local(Date.parse(to) - 864e5);
  // подводку пишет администратор; без неё — заголовок с датами
  const head = intro.trim() ? esc(intro.trim()) : `🗓 <b>Расписание на неделю ${pad(a.getUTCDate())}.${pad(a.getUTCMonth() + 1)} — ${pad(z.getUTCDate())}.${pad(z.getUTCMonth() + 1)}</b>`;
  const app = env.BOT_USERNAME ? `<a href="https://t.me/${env.BOT_USERNAME}">приложение клуба</a>` : 'приложение клуба';
  const foot = `〰️〰️🌿〰️〰️\n\n🪙 <b>Стоимость</b>\n1200 ₽ за 4–5 часовую игру\n\n❓ <b>Как записаться</b>\nПишите @oh_katiakaterina или через ${app}`;
  const blocks = games.map((g) => gameBlock(g, g.taken));
  const parts: string[] = []; let cur = head;
  for (const b of [...blocks, foot]) {
    if ((cur + '\n\n' + b).length > 4000) { parts.push(cur); cur = b; } else cur += `\n\n${b}`;
  }
  parts.push(cur);
  return { parts, count: games.length };
}

type TgApi = (method: string, body: Record<string, unknown>) => Promise<{ ok: boolean; description?: string; result?: { message_id: number } }>;
export const tgApi = (token: string): TgApi => async (method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
};

/** Выкладывает пост: картинка сверху (превью ссылки), под ней расписание. */
export async function postWeek(env: Env, api: TgApi, monday: string, imageUrl: string, opts: { intro?: string; previewTo?: number; extra?: Record<string, unknown> } = {}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const chat = opts.previewTo ?? env.CHANNEL;
  if (!chat) return { ok: false, error: 'Не указан канал клуба' };
  const { parts, count } = await buildPost(env, monday, opts.intro);
  if (!count) return { ok: false, error: 'На этой неделе нет ни одной игры' };
  const button = env.BOT_USERNAME ? { reply_markup: { inline_keyboard: [[{ text: '🐉 Расписание и запись', url: `https://t.me/${env.BOT_USERNAME}` }]] } } : {};
  for (let i = 0; i < parts.length; i++) {
    const last = i === parts.length - 1;
    const r = await api('sendMessage', {
      chat_id: chat, text: parts[i], parse_mode: 'HTML',
      link_preview_options: i === 0 ? { url: imageUrl, prefer_large_media: true, show_above_text: true } : { is_disabled: true },
      ...(last ? (opts.previewTo ? opts.extra ?? {} : button) : {}),
    });
    if (!r.ok) {
      const d = r.description ?? '';
      return { ok: false, error: /not enough rights|administrator|chat not found|member/i.test(d) ? 'Бот не может писать в канал: добавьте его в администраторы канала с правом публикации' : `Telegram не принял пост: ${d}` };
    }
  }
  if (!opts.previewTo) await env.DB.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(`posted:${monday}`, new Date().toISOString()).run();
  return { ok: true, count };
}

/** Напоминания администраторам расписания: в среду и пятницу с 12:00, один раз за день. */
export async function scheduleReminders(env: Env, send: Send, now: number, openBtn: Record<string, unknown>) {
  const d = local(now); const wd = d.getUTCDay();
  if ((wd !== 3 && wd !== 5) || d.getUTCHours() < 12) return;
  const key = `remind:${d.toISOString().slice(0, 10)}`;
  const next = mondayOf(now + 7 * 864e5);
  if (await env.DB.prepare('SELECT 1 FROM meta WHERE key = ?').bind(`posted:${next}`).first()) return; // неделя уже выложена
  const fresh = await env.DB.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING RETURNING key').bind(key, new Date(now).toISOString()).first();
  if (!fresh) return;
  const names = (env.SCHEDULE_ADMINS ?? '').toLowerCase().split(/[\s,]+/).map((x) => x.replace(/^@/, '')).filter(Boolean);
  for (const u of names) {
    const row = await env.DB.prepare('SELECT id, name FROM users WHERE username = ? AND started = 1').bind(u).first<{ id: number; name: string }>();
    if (!row) continue;
    const first = esc(row.name.split(/\s+/)[0] || row.name);
    const text = wd === 3
      ? `🗓 ${first}, привет! Не забудь подготовить расписание на следующую неделю.\n\nНажми «📅 Составить расписание» внизу чата — я спрошу про каждую игру и сам выложу пост в канал.`
      : `⏳ ${first}, следующая неделя уже близко — успей подготовить расписание.\n\nНажми «📅 Составить расписание» внизу чата — это пара минут.`;
    await send(row.id, text, openBtn);
  }
}
