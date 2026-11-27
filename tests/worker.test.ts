import { describe, expect, it, beforeEach } from 'vitest';
import { handle, type Env } from '../worker/src/index';
import { buildPost, mondayOf, scheduleReminders } from '../worker/src/schedule';
import { entitiesToHtml } from '../worker/src/wizard';
import { masterDigest } from '../worker/src/masters';
import { vi } from 'vitest';
import { localDB } from '../worker/src/local-db';
import { signInitData, verifyInitData, type TgUser } from '../worker/src/telegram';

const TOKEN = '123456:TEST-token';
const NOW = Date.parse('2026-11-25T10:00:00+04:00');
const admin: TgUser = { id: 1, first_name: 'Замир', username: 'astrakhan_trener' };
const master: TgUser = { id: 2, first_name: 'Катя', username: 'kate_gm' };
const players: TgUser[] = Array.from({ length: 9 }, (_, i) => ({ id: 100 + i, first_name: `Игрок${i}` }));
let env: Env; let sent: { to: number | string; text: string }[]; let pending: Promise<unknown>[];
const ctx = { waitUntil: (p: Promise<unknown>) => { pending.push(p); } };
const send = async (to: number | string, text: string) => { sent.push({ to, text }); };
async function call(method: string, path: string, user?: TgUser, body?: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (user) headers['x-init-data'] = await signInitData(user, TOKEN, Math.floor(NOW / 1000));
  const r = await handle(new Request(`https://w.test${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, ctx, send, NOW);
  await Promise.all(pending); pending = [];
  return { status: r.status, data: await r.json() as Record<string, any> };
}
const game = { title: 'Драккенхейм', starts_at: '2026-11-28T18:00:00+04:00', room: 'green', master_name: 'Катя', master_username: '@Kate_GM', setting: 'Тёмное фэнтези', system: 'D&D 2014', seats: 6, description: 'Ваншот' };

describe('сервер записей', () => {
  beforeEach(() => { env = { DB: localDB(), BOT_TOKEN: TOKEN, ADMIN_USERNAMES: '@astrakhan_trener', APP_URL: 'https://app.test/app/', BOT_SECRET: 's3cret' }; sent = []; pending = []; });

  it('подпись Telegram проверяется', async () => {
    const good = await signInitData(admin, TOKEN, 1000);
    expect((await verifyInitData(good, TOKEN, 3600, 1500))?.id).toBe(1);
    expect(await verifyInitData(good.replace('astrakhan', 'hacker'), TOKEN, 3600, 1500)).toBeNull();
    expect(await verifyInitData(good, 'other:token', 3600, 1500)).toBeNull();
    expect(await verifyInitData(good, TOKEN, 3600, 1000 + 7200)).toBeNull();
  });

  it('создавать игры может только администратор и мастер', async () => {
    expect((await call('POST', '/api/games', players[0], game)).status).toBe(403);
    expect((await call('POST', '/api/games', undefined, game)).status).toBe(401);
    const r = await call('POST', '/api/games', admin, game); expect(r.status).toBe(200);
    const list = await call('GET', '/api/games');
    expect(list.data.games[0]).toMatchObject({ title: 'Драккенхейм', room: 'green', master_username: 'kate_gm', taken: 0, seats: 6 });
    expect((await call('POST', '/api/games', admin, { title: 'x' })).data.error).toMatch(/дата/);
  });

  it('6 мест, одновременная запись восьмерых, очередь и подтягивание', async () => {
    const { data: { id } } = await call('POST', '/api/games', admin, game);
    const res = await Promise.all(players.slice(0, 8).map((p) => call('POST', `/api/games/${id}/join`, p)));
    expect(res.filter((r) => r.data.status === 'main')).toHaveLength(6);
    expect(res.filter((r) => r.data.status === 'wait')).toHaveLength(2);
    expect((await call('POST', `/api/games/${id}/join`, players[0])).data.error).toMatch(/уже записаны/);
    const g = await call('GET', `/api/games/${id}`, players[0]);
    expect(g.data.game).toMatchObject({ taken: 6, waiting: 2, mine: 'main' }); expect(g.data.players[0].user_id).toBeUndefined();
    const waiter = res.findIndex((r) => r.data.status === 'wait' && r.data.position === 1);
    const quitter = res.findIndex((r) => r.data.status === 'main');
    sent = [];
    await call('POST', `/api/games/${id}/leave`, players[quitter]);
    expect(sent.some((m) => m.to === players[waiter]!.id && /Освободилось место/.test(m.text))).toBe(true);
    expect((await call('GET', `/api/games/${id}`)).data.game).toMatchObject({ taken: 6, waiting: 1 });
  });

  it('мастер правит только свои игры, увеличение мест подтягивает очередь, отмена всех оповещает', async () => {
    await call('POST', '/api/roles', admin, { username: '@Kate_GM', role: 'master' });
    expect((await call('POST', '/api/roles', master, { username: 'x_x_x', role: 'master' })).status).toBe(403);
    const { data: { id } } = await call('POST', '/api/games', master, { ...game, master_username: '', seats: 1 });
    const { data: { id: other } } = await call('POST', '/api/games', admin, { ...game, master_username: 'someone' });
    expect((await call('PUT', `/api/games/${other}`, master, { title: 'чужая' })).status).toBe(403);
    await call('POST', `/api/games/${id}/join`, players[0]); await call('POST', `/api/games/${id}/join`, players[1]);
    const view = await call('GET', `/api/games/${id}`, master); expect(view.data.canEdit).toBe(true); expect(view.data.players[0].user_id).toBe(100);
    sent = [];
    await call('PUT', `/api/games/${id}`, master, { seats: 2 });
    expect(sent.some((m) => m.to === 101 && /Добавили места/.test(m.text))).toBe(true);
    sent = [];
    await call('POST', `/api/games/${id}/cancel`, master);
    expect(sent.filter((m) => /отменена/.test(m.text)).map((m) => m.to).sort()).toEqual([100, 101]);
    expect((await call('POST', `/api/games/${id}/join`, players[2])).data.error).toMatch(/отменена/);
    await call('POST', `/api/games/${id}/add`, master, { name: 'Гость без Telegram' });
    expect((await call('GET', `/api/games/${id}`)).data.players.map((p: { name: string }) => p.name)).toContain('Гость без Telegram');
  });

  it('началась — запись закрыта; напоминаний игрокам больше нет', async () => {
    const { data: { id } } = await call('POST', '/api/games', admin, { ...game, starts_at: '2026-11-25T09:00:00+04:00' });
    expect((await call('POST', `/api/games/${id}/join`, players[0])).data.error).toMatch(/началась/);
  });

  it('вебхук бота защищён секретом и отвечает кнопкой приложения', async () => {
    const upd = { message: { chat: { id: 55 }, text: '/start', from: { id: 55, first_name: 'Новичок' } } };
    expect((await handle(new Request('https://w.test/bot/wrong', { method: 'POST', body: JSON.stringify(upd) }), env, ctx, send, NOW)).status).toBe(403);
    let extra: any; const send2 = async (to: number | string, text: string, e?: Record<string, unknown>) => { sent.push({ to, text }); extra = e; };
    await handle(new Request('https://w.test/bot/s3cret', { method: 'POST', body: JSON.stringify(upd) }), env, ctx, send2, NOW); await Promise.all(pending);
    expect(sent[0]!.to).toBe(55); expect(extra.reply_markup.inline_keyboard[0][0].web_app.url).toBe('https://app.test/app/');
    // меню клиента прямо в боте: приложение, канал, чат
    env.CHANNEL = '@club'; env.CHAT_URL = 'https://t.me/+chat';
    await handle(new Request('https://w.test/bot/s3cret', { method: 'POST', body: JSON.stringify({ message: { ...upd.message, text: 'привет' } }) }), env, ctx, send2, NOW); await Promise.all(pending);
    expect(extra.reply_markup.inline_keyboard[1].map((b: any) => b.url)).toEqual(['https://t.me/club', 'https://t.me/+chat']);
    // запись: анонс в духе D&D, зовём в чат, кнопка чата первой
    const id = (await call('POST', '/api/games', admin, game)).data.id;
    const h: Record<string, string> = { 'content-type': 'application/json', 'x-init-data': await signInitData(players[0]!, TOKEN, Math.floor(NOW / 1000)) };
    sent = [];
    await handle(new Request(`https://w.test/api/games/${id}/join`, { method: 'POST', headers: h }), env, ctx, send2, NOW); await Promise.all(pending); pending = [];
    expect(sent.at(-1)!.text).toMatch(/чат/); expect(sent.at(-1)!.text).not.toMatch(/напомн|напишу ещё/i);
    expect(extra.reply_markup.inline_keyboard[0][0]).toEqual({ text: '💬 Перейти в чат клуба', url: 'https://t.me/+chat' });
  });
  it('пост расписания: оформление как в канале, картинка сверху, без «Запись также»', async () => {
    env.CHANNEL = '@club'; env.BOT_USERNAME = 'club_bot';
    const id = (await call('POST', '/api/games', admin, { ...game, starts_at: '2026-11-29T12:00:00+04:00', level: '4, ваншот', description: 'Старый приют.\n\nЗапись также у @oh_katiakaterina' })).data.id;
    await call('POST', `/api/games/${id}/join`, players[0]);
    await call('POST', '/api/games', admin, { ...game, title: 'Следующая неделя', starts_at: '2026-12-01T12:00:00+04:00' });
    const { parts, count } = await buildPost(env, '2026-11-23');
    expect(count).toBe(1);
    expect(parts[0]).toContain('🟩 <b>ВОСКРЕСЕНЬЕ (29.11), 12:00</b> — <i>осталось 5 мест</i>');
    expect(parts[0]).toContain('<b>Мастер:</b> Катя');
    expect(parts[0]).toContain('<b>В двух словах:</b> Старый приют.');
    expect(parts[0]).not.toContain('Запись также');
    expect(parts[0]).not.toContain('Следующая неделя');
    // игрок выложить не может, администратор — да
    expect((await call('POST', '/api/schedule/post', players[1], { week: '2026-11-23', image_id: 1 })).status).toBe(403);
    const img = (await call('POST', '/api/images', admin, { mime: 'image/png', data: 'iVBORw0KGgo=' })).data.id;
    const calls: any[] = [];
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_u, init) => { calls.push(JSON.parse(String(init!.body))); return new Response(JSON.stringify({ ok: true, result: { message_id: 7 } })); });
    const r = await call('POST', '/api/schedule/post', admin, { week: '2026-11-23', image_id: img });
    spy.mockRestore();
    expect(r.data).toMatchObject({ ok: true, count: 1 });
    expect(calls[0]).toMatchObject({ chat_id: '@club', parse_mode: 'HTML', link_preview_options: { url: `https://w.test/img/${img}`, show_above_text: true } });
    expect(calls[0].reply_markup.inline_keyboard[0][0].url).toBe('https://t.me/club_bot');
    expect((await call('GET', '/api/schedule/preview?week=2026-11-23', admin)).data.posted).toBeTruthy();
  });
  it('бот не админ канала — понятная ошибка', async () => {
    env.CHANNEL = '@club';
    await call('POST', '/api/games', admin, { ...game, starts_at: '2026-11-29T12:00:00+04:00' });
    const img = (await call('POST', '/api/images', admin, { mime: 'image/png', data: 'iVBORw0KGgo=' })).data.id;
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: false, description: 'Bad Request: need administrator rights in the channel chat' })));
    const r = await call('POST', '/api/schedule/post', admin, { week: '2026-11-23', image_id: img });
    spy.mockRestore();
    expect(r.data.error).toMatch(/администраторы канала/);
  });
  it('напоминания админам: в среду и пятницу после 12:00, по разу, не после выкладки недели', async () => {
    env.SCHEDULE_ADMINS = 'oh_katiakaterina, aalkhutova';
    await env.DB.prepare('INSERT INTO users(id, name, username, started) VALUES (51, ?, ?, 1), (52, ?, ?, 1)').bind('Катя К', 'oh_katiakaterina', 'Настя', 'aalkhutova').run();
    const wed = Date.parse('2026-12-02T12:30:00+04:00'), fri = Date.parse('2026-12-04T13:00:00+04:00');
    await scheduleReminders(env, send, Date.parse('2026-12-02T10:00:00+04:00'), {}); expect(sent).toHaveLength(0);
    await scheduleReminders(env, send, wed, {}); await scheduleReminders(env, send, wed + 900000, {});
    expect(sent.map((x) => x.to)).toEqual([51, 52]);
    expect(sent[0]!.text).toMatch(/Катя, привет! Не забудь подготовить расписание на следующую неделю/);
    await env.DB.prepare("INSERT INTO meta(key, value) VALUES (?, 'x')").bind(`posted:${mondayOf(fri + 7 * 864e5)}`).run();
    await scheduleReminders(env, send, fri, {}); expect(sent).toHaveLength(2);
  });
  it('облачные листы: у каждого свои, старая копия не затирает новую, можно удалить и выключить', async () => {
    const put = async (u: TgUser, sh: object) => {
      const headers = { 'x-init-data': await signInitData(u, TOKEN, Math.floor(NOW / 1000)) };
      const r = await handle(new Request(`https://w.test/api/sheets/${(sh as { id: string }).id}?name=Мирра`, { method: 'PUT', headers, body: JSON.stringify(sh) }), env, ctx, send, NOW);
      return r.json() as Promise<Record<string, any>>;
    };
    await put(players[0], { id: 'abc123', updatedAt: 200, pages: [] });
    await put(players[0], { id: 'abc123', updatedAt: 100, pages: ['старое'] });
    const list = await call('GET', '/api/sheets', players[0]);
    expect(list.data.sheets).toEqual([{ id: 'abc123', name: 'Мирра', updated_at: 200 }]);
    expect((await call('GET', '/api/sheets', players[1])).data.sheets).toEqual([]);
    expect((await call('GET', '/api/sheets/abc123', players[1])).status).toBe(404);
    expect((await call('GET', '/api/sheets/abc123', players[0])).data.pages).toEqual([]);
    expect((await call('GET', '/api/sheets')).status).toBe(401);
    await call('DELETE', '/api/sheets', players[0]);
    expect((await put(players[0], { id: 'abc123', updatedAt: 300, pages: [] })).off).toBe(true);
    expect((await call('GET', '/api/sheets', players[0])).data).toMatchObject({ sheets: [], off: true });
    await call('POST', '/api/sheets/on', players[0]);
    await put(players[0], { id: 'abc123', updatedAt: 300, pages: [] });
    expect((await call('GET', '/api/sheets', players[0])).data.sheets).toHaveLength(1);
  });
  it('«Составить расписание» в чате с ботом: вопросы → игра в приложении → пост в канал с картинкой', async () => {
    env.CHANNEL = '@club'; env.BOT_USERNAME = 'club_bot';
    const tgCalls: { m: string; b: any }[] = [];
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (u, init) => {
      const url = String(u);
      if (url.includes('/file/bot')) return new Response(new Uint8Array([255, 216, 255, 0]));
      const m = url.split('/').pop()!; const b = init?.body ? JSON.parse(String(init.body)) : {};
      tgCalls.push({ m, b });
      if (m === 'getFile') return new Response(JSON.stringify({ ok: true, result: { file_path: 'photos/a.jpg' } }));
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
    });
    const kate: TgUser = { id: 51, first_name: 'Катя', username: 'oh_katiakaterina' };
    env.ADMIN_USERNAMES = 'astrakhan_trener, oh_katiakaterina';
    let n = 0;
    const hook = async (u: object) => { await handle(new Request('https://w.test/bot/s3cret', { method: 'POST', body: JSON.stringify({ update_id: ++n, ...u }) }), env, ctx, send, NOW); await Promise.all(pending); pending = []; };
    const say = (text: string) => hook({ message: { chat: { id: 51 }, from: kate, text } });
    const tap = (data: string) => hook({ callback_query: { id: 'q' + n, from: kate, data, message: { chat: { id: 51 }, message_id: 9 } } });
    const photo = () => hook({ message: { chat: { id: 51 }, from: kate, photo: [{ file_id: 'f1', file_size: 1000, width: 800 }] } });
    // обычный игрок кнопку не получает и в диалог не попадает
    await hook({ message: { chat: { id: 100 }, from: players[0], text: '📅 Составить расписание' } });
    expect(sent.at(-1)!.text).toMatch(/в приложении/);
    await say('/start'); expect(sent.at(-1)!.text).toMatch(/Вы администратор/);
    await say('📅 Составить расписание'); expect(sent.at(-1)!.text).toMatch(/На какую неделю/);
    await tap('w:2026-11-30'); expect(sent.at(-1)!.text).toMatch(/Какой день/);
    await tap('d:2026-12-05'); await say('18.30'); await tap('r:green'); await say('Денис'); await say('Объятия матери');
    await tap('s:D&D 5e'); await say('Дарк фэнтези'); await tap('skip'); await say('Старый приют на окраине леса');
    await tap('n:abc'); expect(sent.at(-2)!.text).toMatch(/Не понял/);
    await tap('n:6');
    await photo(); expect(sent.at(-1)!.text).toMatch(/Проверьте игру/);
    expect(sent.at(-1)!.text).toContain('🟩 <b>СУББОТА (05.12), 18:30</b>');
    await tap('save'); expect(sent.at(-1)!.text).toMatch(/уже видна в приложении/);
    const list = await call('GET', '/api/games');
    expect(list.data.games.find((g: any) => g.title === 'Объятия матери')).toMatchObject({ room: 'green', master_name: 'Денис', system: 'D&D 5e', seats: 6, starts_at: '2026-12-05T18:30:00+04:00' });
    await tap('post'); expect(sent.at(-1)!.text).toMatch(/Пришлите картинку для поста/);
    await photo(); expect(sent.at(-1)!.text).toMatch(/подводку/);
    await say('Тьма сгущается над Драккенхеймом');
    // предпросмотр приходит самой Кате, в канал пока ничего
    const preview = tgCalls.find((c) => c.m === 'sendMessage' && c.b.chat_id === 51)!;
    expect(preview.b.text.startsWith('Тьма сгущается над Драккенхеймом')).toBe(true);
    expect(preview.b.text).toContain('〰️〰️🌿〰️〰️');
    expect(preview.b.text).toContain('Пишите @oh_katiakaterina или через <a href="https://t.me/club_bot">');
    expect(preview.b.reply_markup.inline_keyboard[0][0].callback_data).toBe('publish');
    expect(tgCalls.some((c) => c.b.chat_id === '@club')).toBe(false);
    await tap('publish'); expect(sent.at(-1)!.text).toMatch(/выложено в канал, игр в посте: 1/);
    const post = tgCalls.find((c) => c.m === 'sendMessage' && c.b.chat_id === '@club')!;
    expect(post.b.text).toContain('Объятия матери');
    expect(post.b.text.startsWith('Тьма сгущается')).toBe(true);
    expect(post.b.link_preview_options.url).toMatch(/^https:\/\/w\.test\/img\/\d+$/);
    // отмена в любой момент
    await say('📅 Составить расписание'); await say('Отмена'); expect(sent.at(-1)!.text).toMatch(/отменил/);
    spy.mockRestore();
  });
  it('мастера: админ выбирает мастера кнопкой, мастер видит свои игры в боте', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ ok: true, result: { message_id: 1 } })));
    env.ADMIN_USERNAMES = 'astrakhan_trener, oh_katiakaterina';
    env.MASTERS = 'Катя:oh_katiakaterina, Денис:@I_Koschei_I';
    const kate: TgUser = { id: 51, first_name: 'Катя', username: 'oh_katiakaterina' };
    const denis: TgUser = { id: 61, first_name: 'Денис', username: 'I_Koschei_I' };
    const out: { to: number | string; text: string; extra?: any }[] = [];
    const s2 = async (to: number | string, text: string, extra?: Record<string, unknown>) => { out.push({ to, text, extra }); };
    let n = 0;
    const hook = async (u: object) => { await handle(new Request('https://w.test/bot/s3cret', { method: 'POST', body: JSON.stringify({ update_id: ++n, ...u }) }), env, ctx, s2, NOW); await Promise.all(pending); pending = []; };
    const say = (who: TgUser, text: string) => hook({ message: { chat: { id: who.id }, from: who, text } });
    const tap = (who: TgUser, data: string) => hook({ callback_query: { id: 'q' + n, from: who, data, message: { chat: { id: who.id }, message_id: 9 } } });
    const kb = (e: any) => (e?.reply_markup?.keyboard ?? []).flat().map((b: any) => b.text);
    // Денис заходит в бота: у него кнопка мастера, но нет кнопки расписания
    await say(denis, '/start');
    expect(out.at(-1)!.text).toMatch(/Денис, вы мастер клуба/);
    expect(kb(out.at(-1)!.extra)).toEqual(['🎲 Игры, которые я веду']);
    await say(denis, '🎲 Игры, которые я веду'); expect(out.at(-1)!.text).toMatch(/пока нет запланированных игр/);
    // Катя — и админ, и мастер: две кнопки
    await say(kate, '/start'); expect(kb(out.at(-1)!.extra)).toEqual(['📅 Составить расписание', '🎲 Игры, которые я веду']);
    // старая игра без ника, где мастер записан именем, тоже попадает Денису
    await call('POST', '/api/games', admin, { ...game, title: 'Старая', master_name: 'Денис', master_username: '' });
    await say(kate, '📅 Составить расписание'); await tap(kate, 'w:2026-11-30'); await tap(kate, 'd:2026-12-05'); await say(kate, '18:30'); await tap(kate, 'r:red');
    const ask = out.at(-1)!;
    expect(ask.text).toMatch(/Кто мастер\? Нажмите имя/);
    const btns = ask.extra.reply_markup.inline_keyboard.flat().map((b: any) => b.callback_data);
    expect(btns).toEqual(expect.arrayContaining(['m:oh_katiakaterina', 'm:i_koschei_i', 'm:?']));
    await tap(kate, 'm:i_koschei_i'); expect(out.at(-1)!.text).toMatch(/Название игры/);
    await say(kate, 'Объятия матери'); await tap(kate, 's:D&D 5e'); await tap(kate, 'skip'); await tap(kate, 'skip'); await tap(kate, 'skip'); await tap(kate, 'n:5'); await tap(kate, 'skip');
    out.length = 0;
    await tap(kate, 'save');
    expect(out.find((m) => m.to === 61)?.text).toMatch(/Вас поставили мастером: <b>Объятия матери<\/b>, Сб 05\.12 в 18:30, Красная/);
    const g = (await call('GET', '/api/games')).data.games.find((x: any) => x.title === 'Объятия матери');
    expect(g).toMatchObject({ master_name: 'Денис', master_username: 'i_koschei_i' });
    await call('POST', `/api/games/${g.id}/join`, players[0]);
    // Денис открывает свои игры: обе, по порядку, с записью
    await say(denis, '🎲 Игры, которые я веду');
    const list = out.at(-1)!;
    expect(list.text.indexOf('Старая')).toBeLessThan(list.text.indexOf('Объятия матери'));
    expect(list.text).toMatch(/Объятия матери\nЗаписались 1 из 5/);
    await tap(denis, `mg:${g.id}`); expect(out.at(-1)!.text).toMatch(/Игроки: 1 из 5\n1\. Игрок0/);
    // чужой игрок кнопку мастера не получает
    await say(players[1]!, '🎲 Игры, которые я веду'); expect(out.at(-1)!.text).toMatch(/для мастеров клуба/);
    await tap(players[1]!, `mg:${g.id}`); expect(out.at(-1)!.text).not.toMatch(/Игрок0/);
    spy.mockRestore();
  });
  it('список мастеров правит админ в приложении; вечером мастеру сводка на завтра, без сообщений на каждую запись', async () => {
    env.MASTERS = 'Катя:oh_katiakaterina';
    const kate: TgUser = { id: 51, first_name: 'Катя', username: 'oh_katiakaterina' };
    const lenya: TgUser = { id: 71, first_name: 'Леонид', username: 'Krodys' };
    expect((await call('GET', '/api/masters', players[0])).status).toBe(403);
    expect((await call('GET', '/api/masters', admin)).data.masters).toEqual([{ name: 'Катя', username: 'oh_katiakaterina' }]);
    expect((await call('POST', '/api/masters', admin, { name: 'Лёня', username: 'ой' })).data.error).toMatch(/латиница/);
    expect((await call('POST', '/api/masters', admin, { name: 'Лёня', username: 'https://t.me/Krodys' })).data.masters.map((m: any) => m.username)).toEqual(['oh_katiakaterina', 'krodys']);
    // удалённый стартовый мастер не возвращается сам
    await call('DELETE', '/api/masters/oh_katiakaterina', admin);
    expect((await call('GET', '/api/masters', admin)).data.masters.map((m: any) => m.name)).toEqual(['Лёня']);
    expect((await call('DELETE', '/api/masters/krodys', kate)).status).toBe(403);
    // игра Лёни завтра и игра через три дня
    const id = (await call('POST', '/api/games', admin, { ...game, title: 'Завтрашняя', starts_at: '2026-11-26T18:00:00+04:00', master_name: 'Лёня', master_username: 'krodys' })).data.id;
    await call('POST', '/api/games', admin, { ...game, title: 'Потом', starts_at: '2026-11-28T18:00:00+04:00', master_name: 'Лёня', master_username: 'krodys' });
    await call('GET', '/api/me', lenya);
    await handle(new Request('https://w.test/bot/s3cret', { method: 'POST', body: JSON.stringify({ message: { chat: { id: 71 }, from: lenya, text: '/start' } }) }), env, ctx, send, NOW); await Promise.all(pending); pending = [];
    sent = [];
    await call('POST', `/api/games/${id}/join`, players[0]); await call('POST', `/api/games/${id}/join`, players[1]);
    expect(sent.filter((m) => m.to === 71)).toHaveLength(0);
    const evening = Date.parse('2026-11-25T19:00:00+04:00');
    expect(await masterDigest(env, send, evening)).toBe(1);
    const d = sent.filter((m) => m.to === 71);
    expect(d).toHaveLength(1);
    expect(d[0]!.text).toMatch(/Лёня, завтра ваша игра/); expect(d[0]!.text).toContain('Завтрашняя'); expect(d[0]!.text).not.toContain('Потом');
    expect(d[0]!.text).toMatch(/Игроки: 2 из 6\n1\. Игрок0\n2\. Игрок1/);
    expect(await masterDigest(env, send, evening + 3600_000)).toBe(0);
  });
  it('подводка: оформление из Telegram (жирный, курсив, цитата, ссылка) переносится в пост, лишнее экранируется', () => {
    const t = 'Два стола свободны (уже нет)\nПриходите <смело>';
    const html = entitiesToHtml(t, [{ type: 'bold', offset: 0, length: 18 }, { type: 'italic', offset: 19, length: 9 }, { type: 'blockquote', offset: 29, length: 17 }, { type: 'mention', offset: 0, length: 3 }]);
    expect(html).toBe('<b>Два стола свободны</b> <i>(уже нет)</i>\n<blockquote>Приходите &lt;смело&gt;</blockquote>');
    expect(entitiesToHtml('тут', [{ type: 'text_link', offset: 0, length: 3, url: 'javascript:alert(1)' }])).toBe('тут');
  });
  it('админ записывает по нику: игрок видит игру в «Мои» — и если уже заходил, и если зайдёт позже', async () => {
    const id = (await call('POST', '/api/games', admin, game)).data.id;
    const p1: TgUser = { id: 301, first_name: 'Знакомый', username: 'old_friend' }, p0: TgUser = { id: 300, first_name: 'Коля', username: 'kolya_new' };
    await call('GET', '/api/me', p1); // этот уже заходил в бота
    const u1 = p1.username!, u0 = p0.username!;
    await call('POST', `/api/games/${id}/add`, admin, { name: `Знакомый @${u1}` });
    await call('POST', `/api/games/${id}/add`, admin, { name: `Коля @${u0}` });
    expect((await call('POST', `/api/games/${id}/add`, admin, { name: `ещё раз @${u1}` })).status).toBe(400);
    expect((await call('GET', '/api/me', p1)).data.games.map((g: any) => g.id)).toContain(id);
    // Коля заходит впервые — запись по нику становится его
    const me0 = await call('GET', '/api/me', p0);
    expect(me0.data.games.find((g: any) => g.id === id)?.mine).toBe('main');
    expect((await call('GET', '/api/games', p0)).data.games.find((g: any) => g.id === id).mine).toBe('main');
  });
  it('при записи бот присылает анонс игры в духе D&D — и самому записавшемуся, и тому, кого записал админ', async () => {
    const id = (await call('POST', '/api/games', admin, { ...game, title: 'Объятия матери', description: 'Старый приют.\nЗапись также у @x' })).data.id;
    sent = [];
    await call('POST', `/api/games/${id}/join`, players[2]); await Promise.all(pending);
    const t = sent.find((m) => m.to === players[2]!.id)!.text;
    expect(t).toContain('<b>Объятия матери</b>'); expect(t).toContain('Мастер:'); expect(t).toContain('Старый приют.'); expect(t).not.toContain('Запись также');
    expect(t).toContain('Игрок2');
    const known: TgUser = { id: 401, first_name: 'Коля', username: 'kolya_k' };
    await call('GET', '/api/me', known); sent = [];
    await call('POST', `/api/games/${id}/add`, admin, { name: 'Коля @kolya_k' }); await Promise.all(pending);
    expect(sent.find((m) => m.to === 401)!.text).toContain('Объятия матери');
  });
});
