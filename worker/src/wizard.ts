/**
 * «Составить расписание» прямо в чате с ботом: бот задаёт вопросы по одной игре,
 * сохраняет её (она сразу появляется в приложении), предлагает следующую или выложить неделю в канал.
 */
import { esc, type Send, type TgUser } from './telegram';
import type { Env } from './index';
import { gameBlock, mondayOf, postWeek, tgApi } from './schedule';

export const SCHEDULE_BTN = '📅 Составить расписание';
type Photo = { file_id: string; file_size?: number; width: number };
type Entity = { type: string; offset: number; length: number; url?: string };
export interface Upd {
  message?: { chat: { id: number }; text?: string; entities?: Entity[]; from?: TgUser; photo?: Photo[] };
  callback_query?: { id: string; from: TgUser; data?: string; message?: { chat: { id: number }; message_id: number } };
}
interface Draft {
  week: string; day?: string; time?: string; room?: 'red' | 'green'; master?: string; title?: string; system?: string;
  setting?: string; level?: string; description?: string; seats?: number; price?: string; image_id?: number | null; post_image?: number; intro?: string;
}
type Kb = { text: string; cb: string }[][];
const ik = (rows: Kb) => ({ reply_markup: { inline_keyboard: rows.map((r) => r.map((b) => ({ text: b.text, callback_data: b.cb }))) } });
const SKIP = { text: 'Пропустить', cb: 'skip' };
const CANCEL = { text: '✖ Отмена', cb: 'x' };
const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const wdOf = (d: string) => WD[new Date(`${d}T12:00:00Z`).getUTCDay()]!;

export const isAdmin = (env: Env, username?: string) => !!username && (env.ADMIN_USERNAMES ?? '').toLowerCase().split(/[\s,]+/).map((x) => x.replace(/^@/, '')).includes(username.toLowerCase());
export const adminKeyboard = { reply_markup: { keyboard: [[{ text: SCHEDULE_BTN }]], resize_keyboard: true, is_persistent: true } };

async function getState(env: Env, uid: number) {
  const r = await env.DB.prepare('SELECT step, data FROM bot_state WHERE user_id = ?').bind(uid).first<{ step: string; data: string }>();
  return r ? { step: r.step, d: JSON.parse(r.data) as Draft } : null;
}
const setState = (env: Env, uid: number, step: string, d: Draft, now: number) =>
  env.DB.prepare('INSERT INTO bot_state(user_id, step, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET step = excluded.step, data = excluded.data, updated_at = excluded.updated_at').bind(uid, step, JSON.stringify(d), now).run();
const clearState = (env: Env, uid: number) => env.DB.prepare('DELETE FROM bot_state WHERE user_id = ?').bind(uid).run();

/** Картинку из Telegram — в нашу базу (как картинки из приложения). */
async function savePhoto(env: Env, photos: Photo[]): Promise<number | null> {
  const fit = [...photos].sort((a, b) => b.width - a.width).find((p) => (p.file_size ?? 0) <= 1_000_000) ?? photos[0];
  if (!fit) return null;
  const f = await tgApi(env.BOT_TOKEN)('getFile', { file_id: fit.file_id }) as { ok: boolean; result?: { file_path?: string } };
  if (!f.ok || !f.result?.file_path) return null;
  const buf = new Uint8Array(await (await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${f.result.file_path}`)).arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const data = btoa(s); if (data.length > 1_400_000) return null;
  const r = await env.DB.prepare('INSERT INTO images(mime, data) VALUES (?, ?)').bind('image/jpeg', data).run();
  return Number(r.meta.last_row_id);
}

/** Текст с оформлением из Telegram (жирный, курсив, цитата, ссылки…) → HTML для поста. Свои теги ставим сами, текст экранируем. */
const TAGS: Record<string, [string, string]> = {
  bold: ['<b>', '</b>'], italic: ['<i>', '</i>'], underline: ['<u>', '</u>'], strikethrough: ['<s>', '</s>'], spoiler: ['<tg-spoiler>', '</tg-spoiler>'],
  code: ['<code>', '</code>'], pre: ['<pre>', '</pre>'], blockquote: ['<blockquote>', '</blockquote>'], expandable_blockquote: ['<blockquote expandable>', '</blockquote>'],
};
export function entitiesToHtml(text: string, entities: Entity[] = []): string {
  const open = new Map<number, string[]>(), close = new Map<number, string[]>();
  const add = (m: Map<number, string[]>, i: number, t: string, front = false) => { const a = m.get(i) ?? []; front ? a.unshift(t) : a.push(t); m.set(i, a); };
  for (const e of [...entities].sort((a, b) => a.offset - b.offset || b.length - a.length)) {
    const t = e.type === 'text_link' && e.url && /^https?:\/\//.test(e.url) ? [`<a href="${esc(e.url).replace(/"/g, '&quot;')}">`, '</a>'] as [string, string] : TAGS[e.type];
    if (!t) continue;
    add(open, e.offset, t[0]); add(close, e.offset + e.length, t[1], true);
  }
  let out = '';
  for (let i = 0; i <= text.length; i++) {
    out += (close.get(i) ?? []).join('') + (open.get(i) ?? []).join('');
    if (i < text.length) out += esc(text[i]!);
  }
  return out;
}
const DEFAULT_INTRO = '<b>Расписание игр на неделю</b>\n\n<blockquote>Приходить можно совершенно без знания правил, объясним всё в процессе. И не бойтесь приходить одни, у нас вы встретите единомышленников</blockquote>';

/** Вопрос для шага. */
async function ask(env: Env, send: Send, chat: number, step: string, d: Draft) {
  const q = (t: string, rows: Kb = []) => send(chat, t, ik([...rows, [CANCEL]]));
  switch (step) {
    case 'week': {
      const cur = mondayOf(Date.now()), nxt = addDays(cur, 7);
      return q('На какую неделю составляем расписание?', [[{ text: `Следующая (${dm(nxt)}–${dm(addDays(nxt, 6))})`, cb: `w:${nxt}` }], [{ text: `Эта неделя (${dm(cur)}–${dm(addDays(cur, 6))})`, cb: `w:${cur}` }]]);
    }
    case 'day': {
      const days = Array.from({ length: 7 }, (_, i) => addDays(d.week, i));
      const cnt = new Map<string, number>();
      for (const g of (await env.DB.prepare("SELECT starts_at FROM games WHERE status = 'open' AND starts_at >= ? AND starts_at < ?").bind(d.week, addDays(d.week, 8)).all<{ starts_at: string }>()).results) { const k = new Date(Date.parse(g.starts_at) + 4 * 3600_000).toISOString().slice(0, 10); cnt.set(k, (cnt.get(k) ?? 0) + 1); }
      const b = days.map((x) => ({ text: `${wdOf(x)} ${dm(x)}${cnt.get(x) ? ` · ${cnt.get(x)}` : ''}`, cb: `d:${x}` }));
      const total = [...cnt.entries()].filter(([k]) => k >= d.week && k <= addDays(d.week, 6)).reduce((t, [, v]) => t + v, 0);
      return q('📅 Какой день добавляем? (цифра — сколько игр уже стоит)', [b.slice(0, 4), b.slice(4), ...(total ? [[{ text: `📣 Выложить неделю в канал (игр: ${total})`, cb: 'post' }]] : [])]);
    }
    case 'time': return q(`🕐 Во сколько начало? Нажмите или напишите, например 18:30`, [[{ text: '12:00', cb: 't:12:00' }, { text: '17:00', cb: 't:17:00' }, { text: '18:00', cb: 't:18:00' }], [{ text: '18:30', cb: 't:18:30' }, { text: '19:00', cb: 't:19:00' }]]);
    case 'room': return q('🚪 Какая комната?', [[{ text: '🟥 Красная', cb: 'r:red' }, { text: '🟩 Зелёная', cb: 'r:green' }]]);
    case 'master': return q('🎲 Кто мастер? Напишите имя');
    case 'title': return q('📜 Название игры или приключения?');
    case 'system': return q('⚙️ Система?', [[{ text: 'D&D 5e', cb: 's:D&D 5e' }, { text: 'D&D 2014', cb: 's:D&D 2014' }, { text: 'D&D 2024', cb: 's:D&D 2024' }], [{ text: 'Зов Ктулху', cb: 's:Зов Ктулху' }, { text: 'Другая — напишу', cb: 's:?' }]]);
    case 'system_text': return q('Напишите систему');
    case 'setting': return q('🌍 Сеттинг? Например: дарк фэнтези, расследование', [[SKIP]]);
    case 'level': return q('⭐ Уровень? Например: 3, ваншот, можно новичкам', [[SKIP]]);
    case 'description': return q('✍️ В двух словах — о чём игра?', [[SKIP]]);
    case 'seats': return q('👥 Сколько мест?', [[{ text: '4', cb: 'n:4' }, { text: '5', cb: 'n:5' }, { text: '6', cb: 'n:6' }, { text: '8', cb: 'n:8' }]]);
    case 'price': return q('🪙 Стоимость?', [[{ text: '1200 ₽', cb: 'p:1200 ₽' }, { text: '1500 ₽', cb: 'p:1500 ₽' }, { text: '500 ₽', cb: 'p:500 ₽' }], [{ text: 'Напишу свою', cb: 'p:?' }]]);
    case 'price_text': return q('Напишите стоимость');
    case 'image': return q('🖼 Картинка для этой игры? Пришлите фото или пропустите', [[SKIP]]);
    case 'confirm': {
      const fake = { id: 0, title: d.title ?? '', starts_at: `${d.day}T${d.time}:00+04:00`, duration_min: 240, room: d.room ?? 'red', master_name: d.master ?? '', master_username: '', setting: d.setting ?? '', system: d.system ?? '', level: d.level ?? '', price: d.price ?? '', seats: d.seats ?? 6, image_id: d.image_id ?? null, description: d.description ?? '', status: 'open', created_by: '', created_at: '' };
      return q(`Проверьте игру:\n\n${gameBlock(fake, 0)}${d.image_id ? '\n🖼 с картинкой' : ''}`, [[{ text: '✅ Сохранить', cb: 'save' }, { text: '↺ Заново', cb: 'redo' }]]);
    }
    case 'post_image': return q('📣 Пришлите картинку для поста — она будет сверху, под ней расписание недели');
    case 'review': return q('Что делаем с постом?', [[{ text: '✅ Выложить в канал', cb: 'publish' }], [{ text: '✍️ Другая подводка', cb: 'reintro' }, { text: '🖼 Другая картинка', cb: 'reimg' }]]);
    case 'intro': return q('✍️ <b>Оглавление (подводка)</b> — текст в начале поста, перед играми.\n\nПишите и оформляйте прямо здесь, как обычное сообщение: выделите слова → «Форматирование» → <b>Жирный</b>, <i>Курсив</i> или «Цитата». Бот сохранит оформление в посте.\n\nИли возьмите стандартную подводку.', [[{ text: '📝 Стандартная подводка', cb: 'std' }], [{ text: 'Без подводки — только даты', cb: 'skip' }]]);
  }
}

const NEXT: Record<string, string> = { week: 'day', day: 'time', time: 'room', room: 'master', master: 'title', title: 'system', system: 'setting', system_text: 'setting', setting: 'level', level: 'description', description: 'seats', seats: 'image', image: 'confirm' };

/** true — сообщение было для мастера расписания и уже обработано. */
export async function wizard(env: Env, upd: Upd, send: Send, origin: string, now = Date.now()): Promise<boolean> {
  const cq = upd.callback_query; const msg = upd.message;
  const from = cq?.from ?? msg?.from; const chat = cq?.message?.chat.id ?? msg?.chat.id;
  if (!from || !chat || !isAdmin(env, from.username)) return false;
  const tg = tgApi(env.BOT_TOKEN);
  if (cq) {
    await tg('answerCallbackQuery', { callback_query_id: cq.id }).catch(() => undefined);
    if (cq.message) await tg('editMessageReplyMarkup', { chat_id: chat, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
  }
  const text = msg?.text?.trim() ?? ''; const cb = cq?.data ?? '';
  if (text === SCHEDULE_BTN || text.startsWith('/schedule')) {
    const d: Draft = { week: '' }; await setState(env, from.id, 'week', d, now); await ask(env, send, chat, 'week', d); return true;
  }
  if (text.startsWith('/start')) { await clearState(env, from.id); return false; }
  const st = await getState(env, from.id);
  if (!st) return false;
  if (cb === 'x' || /^(\/cancel|отмена)$/i.test(text)) { await clearState(env, from.id); await send(chat, 'Ок, отменил. Сохранённые игры остались в расписании.', adminKeyboard); return true; }
  const d = st.d; let step = st.step; let val: string | undefined; let ok = true;
  const pick = (p: string) => (cb.startsWith(p) ? cb.slice(p.length) : undefined);
  switch (step) {
    case 'week': val = pick('w:'); if (val) d.week = val; else ok = false; break;
    case 'day':
      if (cb === 'post') { await setState(env, from.id, 'post_image', d, now); await ask(env, send, chat, 'post_image', d); return true; }
      val = pick('d:'); if (val) d.day = val; else ok = false; break;
    case 'time': { const t = pick('t:') ?? text; const m = t.match(/^(\d{1,2})[:.](\d{2})$/); if (m && +m[1]! < 24 && +m[2]! < 60) d.time = `${m[1]!.padStart(2, '0')}:${m[2]}`; else ok = false; break; }
    case 'room': val = pick('r:'); if (val === 'red' || val === 'green') d.room = val; else ok = false; break;
    case 'master': if (text) d.master = text.slice(0, 80); else ok = false; break;
    case 'title': if (text) d.title = text.slice(0, 120); else ok = false; break;
    case 'system': val = pick('s:'); if (val === '?') { await setState(env, from.id, 'system_text', d, now); await ask(env, send, chat, 'system_text', d); return true; } if (val) d.system = val; else if (text) d.system = text.slice(0, 60); else ok = false; break;
    case 'system_text': if (text) d.system = text.slice(0, 60); else ok = false; break;
    case 'setting': case 'level': case 'description': if (cb === 'skip') d[step] = ''; else if (text) d[step] = text.slice(0, step === 'description' ? 1500 : 120); else ok = false; break;
    case 'seats': { const n = Number(pick('n:') ?? text); if (Number.isInteger(n) && n >= 1 && n <= 20) { d.seats = n; d.price = '1200 ₽'; } else ok = false; break; }
    case 'price': val = pick('p:'); if (val === '?') { await setState(env, from.id, 'price_text', d, now); await ask(env, send, chat, 'price_text', d); return true; } if (val) d.price = val; else if (text) d.price = text.slice(0, 60); else ok = false; break;
    case 'price_text': if (text) d.price = text.slice(0, 60); else ok = false; break;
    case 'image':
      if (cb === 'skip') d.image_id = null;
      else if (msg?.photo?.length) { d.image_id = await savePhoto(env, msg.photo); if (!d.image_id) { await send(chat, 'Не получилось сохранить картинку, попробуйте другую или пропустите.'); return true; } }
      else ok = false; break;
    case 'confirm':
      if (cb === 'redo') { const nd: Draft = { week: d.week }; await setState(env, from.id, 'day', nd, now); await ask(env, send, chat, 'day', nd); return true; }
      if (cb !== 'save') { ok = false; break; }
      await env.DB.prepare(`INSERT INTO games(title, starts_at, duration_min, room, master_name, master_username, setting, system, level, price, seats, image_id, description, created_by, created_at)
        VALUES (?, ?, 240, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(d.title, `${d.day}T${d.time}:00+04:00`, d.room, d.master ?? '', d.setting ?? '', d.system ?? '', d.level ?? '', d.price ?? '', d.seats ?? 6, d.image_id ?? null, d.description ?? '', (from.username ?? '').toLowerCase(), new Date(now).toISOString()).run();
      {
        const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM games WHERE status = 'open' AND starts_at >= ? AND starts_at < ?").bind(d.week, addDays(d.week, 7)).first<{ n: number }>();
        await setState(env, from.id, 'after', { week: d.week }, now);
        await send(chat, `✅ Игра «${esc(d.title ?? '')}» в расписании — она уже видна в приложении.\nНа неделе ${dm(d.week)}–${dm(addDays(d.week, 6))} игр: ${n?.n ?? '?'}`, ik([[{ text: '➕ Следующая игра', cb: 'more' }], [{ text: '📣 Выложить в канал', cb: 'post' }], [{ text: 'Готово, выложу потом', cb: 'done' }]]));
      }
      return true;
    case 'after':
      if (cb === 'more') { const nd: Draft = { week: d.week }; await setState(env, from.id, 'day', nd, now); await ask(env, send, chat, 'day', nd); return true; }
      if (cb === 'post') { await setState(env, from.id, 'post_image', d, now); await ask(env, send, chat, 'post_image', d); return true; }
      if (cb === 'done') { await clearState(env, from.id); await send(chat, 'Готово. Чтобы выложить неделю в канал позже — нажмите «📅 Составить расписание», выберите неделю и «📣 Выложить неделю в канал».', adminKeyboard); return true; }
      ok = false; break;
    case 'post_image': {
      if (!msg?.photo?.length) { ok = false; break; }
      const img = await savePhoto(env, msg.photo);
      if (!img) { await send(chat, 'Не получилось сохранить картинку, пришлите другую.'); return true; }
      d.post_image = img; await setState(env, from.id, 'intro', d, now); await ask(env, send, chat, 'intro', d); return true;
    }
    case 'intro':
      if (cb === 'skip') d.intro = ''; else if (cb === 'std') d.intro = DEFAULT_INTRO; else if (msg?.text) d.intro = entitiesToHtml(msg.text.slice(0, 2500), msg.entities); else { ok = false; break; }
      // предпросмотр: тот же пост, но сюда, в чат администратора
      await send(chat, '👀 Так пост будет выглядеть в канале:');
      {
        const r = await postWeek(env, tg, d.week, `${origin}/img/${d.post_image}`, { intro: d.intro, previewTo: chat, extra: ik([[{ text: '✅ Выложить в канал', cb: 'publish' }], [{ text: '✍️ Другая подводка', cb: 'reintro' }, { text: '🖼 Другая картинка', cb: 'reimg' }], [CANCEL]]) });
        if (!r.ok) { await send(chat, `Не получилось собрать пост: ${esc(r.error)}`); return true; }
      }
      await setState(env, from.id, 'review', d, now); return true;
    case 'review':
      if (cb === 'reintro') { await setState(env, from.id, 'intro', d, now); await ask(env, send, chat, 'intro', d); return true; }
      if (cb === 'reimg') { await setState(env, from.id, 'post_image', d, now); await ask(env, send, chat, 'post_image', d); return true; }
      if (cb === 'publish') {
        const r = await postWeek(env, tg, d.week, `${origin}/img/${d.post_image}`, { intro: d.intro });
        if (r.ok) { await clearState(env, from.id); await send(chat, `📣 Готово! Расписание выложено в канал, игр в посте: ${r.count}.`, adminKeyboard); }
        else await send(chat, `Не получилось выложить: ${esc(r.error)}`);
        return true;
      }
      ok = false; break;
  }
  if (!ok) { await send(chat, step === 'image' || step === 'post_image' ? 'Жду фото 🙂' : 'Не понял ответ, попробуйте ещё раз.'); await ask(env, send, chat, step, d); return true; }
  step = NEXT[step] ?? step;
  await setState(env, from.id, step, d, now);
  await ask(env, send, chat, step, d);
  return true;
}
