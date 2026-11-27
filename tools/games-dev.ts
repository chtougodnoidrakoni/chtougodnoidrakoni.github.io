// Локальный сервер записей для разработки и браузерных тестов: тот же код, что в Cloudflare, база — SQLite в памяти.
import { createServer } from 'node:http';
import { handle, type Env } from '../worker/src/index';
import { localDB } from '../worker/src/local-db';
import { signInitData } from '../worker/src/telegram';

const PORT = Number(process.env.PORT ?? 8787);
const env: Env = { DB: localDB(':memory:', new URL(`file://${process.cwd()}/worker/schema.sql`)), BOT_TOKEN: '123456:DEV', ADMIN_USERNAMES: 'astrakhan_trener', BOT_SECRET: 'dev', MASTERS: 'Катя:oh_katiakaterina,Денис:i_koschei_i' };
const ctx = { waitUntil: (p: Promise<unknown>) => void p };
const send = async (to: number | string, text: string) => { console.log(`[бот → ${to}] ${text.replace(/\n/g, ' ')}`); };

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (url.pathname === '/dev/init') {
    const id = Number(url.searchParams.get('id') ?? 1);
    const init = await signInitData({ id, first_name: url.searchParams.get('name') ?? `Игрок ${id}`, username: url.searchParams.get('username') ?? undefined }, env.BOT_TOKEN);
    res.writeHead(200, { 'access-control-allow-origin': '*', 'content-type': 'text/plain' }); res.end(init); return;
  }
  const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await handle(new Request(url, { method: req.method, headers: req.headers as Record<string, string>, body: body && req.method !== 'GET' ? body : undefined }), env, ctx, send);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, () => console.log(`games-dev: http://localhost:${PORT}`));
