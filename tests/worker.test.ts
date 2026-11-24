import { describe, expect, it, beforeEach } from 'vitest';
import { handle, remind, type Env } from '../worker/src/index';
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

  it('началась — запись закрыта; напоминания за сутки и за 2 часа уходят один раз', async () => {
    const { data: { id } } = await call('POST', '/api/games', admin, { ...game, starts_at: '2026-11-25T09:00:00+04:00' });
    expect((await call('POST', `/api/games/${id}/join`, players[0])).data.error).toMatch(/началась/);
    const { data: { id: g2 } } = await call('POST', '/api/games', admin, { ...game, starts_at: '2026-11-26T09:00:00+04:00' });
    await call('POST', `/api/games/${g2}/join`, players[0]);
    sent = [];
    await remind(env, send, NOW); await remind(env, send, NOW);
    expect(sent.filter((m) => /Завтра игра/.test(m.text))).toHaveLength(1);
    await remind(env, send, Date.parse('2026-11-26T07:00:00+04:00'));
    expect(sent.filter((m) => /Скоро игра/.test(m.text))).toHaveLength(1);
  });

  it('вебхук бота защищён секретом и отвечает кнопкой приложения', async () => {
    const upd = { message: { chat: { id: 55 }, text: '/start', from: { id: 55, first_name: 'Новичок' } } };
    expect((await handle(new Request('https://w.test/bot/wrong', { method: 'POST', body: JSON.stringify(upd) }), env, ctx, send, NOW)).status).toBe(403);
    let extra: any; const send2 = async (to: number | string, text: string, e?: Record<string, unknown>) => { sent.push({ to, text }); extra = e; };
    await handle(new Request('https://w.test/bot/s3cret', { method: 'POST', body: JSON.stringify(upd) }), env, ctx, send2, NOW); await Promise.all(pending);
    expect(sent[0]!.to).toBe(55); expect(extra.reply_markup.inline_keyboard[0][0].web_app.url).toBe('https://app.test/app/');
  });
});
