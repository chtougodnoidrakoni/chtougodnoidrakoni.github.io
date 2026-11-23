// Публикация пакета в общую базу сайта через GitHub API. Работает только с ключом доступа.
import { packText, validate, type PackIn } from './content';

const REPO = 'chtougodnoidrakoni/chtougodnoidrakoni.github.io';
const API = `https://api.github.com/repos/${REPO}/contents/`;
export const tokenOk = (t: string) => /^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t);

const b64 = (s: string) => { const bytes = new TextEncoder().encode(s); let bin = ''; bytes.forEach((x) => (bin += String.fromCharCode(x))); return btoa(bin); };
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

async function call(path: string, token: string, init?: RequestInit) {
  const r = await fetch(API + path, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...(init?.headers ?? {}) } });
  if (r.status === 401) throw new Error('ключ не подходит или истёк');
  if (r.status === 403) throw new Error('у ключа нет права записи в репозиторий клуба');
  return r;
}
async function put(path: string, text: string, message: string, token: string) {
  const cur = await call(`${path}?ref=main`, token);
  const sha = cur.ok ? ((await cur.json()) as { sha: string }).sha : undefined;
  const r = await call(path, token, { method: 'PUT', body: JSON.stringify({ message, content: b64(text), branch: 'main', ...(sha ? { sha } : {}) }) });
  if (!r.ok) throw new Error(`GitHub ответил ${r.status}`);
}

export async function publish(p: PackIn, token: string) {
  if (!tokenOk(token)) throw new Error('введите ключ доступа');
  const rep = validate(p);
  if (!rep.ok) throw new Error(rep.errors[0]);
  const file = `${p.pack_id}.json`;
  await put(`public/content/packs/${file}`, packText(p), `Библиотека: пакет «${p.pack_name}» v${p.pack_version ?? 1}`, token);
  const idxRes = await call('public/content/index.json?ref=main', token);
  const idx = idxRes.ok ? (JSON.parse(unb64(((await idxRes.json()) as { content: string }).content)) as { packs: string[] }) : { packs: [] };
  if (!idx.packs.includes(file)) { idx.packs.push(file); await put('public/content/index.json', JSON.stringify(idx, null, 2) + '\n', `Библиотека: в списке пакет ${file}`, token); }
}
