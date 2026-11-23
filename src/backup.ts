/** Резервные копии и ссылки на лист — без сервера. */
import { get as idbGet } from 'idb-keyval';
import type { Sheet } from './model';
import type { SheetMeta } from './store';

export const BACKUP_KIND = 'chd-backup';
export async function allSheets(index: SheetMeta[]): Promise<Sheet[]> {
  const out: Sheet[] = [];
  for (const m of index) { const s = await idbGet<Sheet>(`sheet:${m.id}`).catch(() => undefined); if (s) out.push(s); }
  return out;
}
export const isSheet = (s: unknown): s is Sheet => !!s && typeof s === 'object' && Array.isArray((s as Sheet).pages) && Array.isArray((s as Sheet).spells);
/** Из файла: один лист или резервная копия со многими. */
export function sheetsFromFile(data: unknown): Sheet[] {
  if (isSheet(data)) return [data];
  const d = data as { kind?: string; sheets?: unknown[] };
  if (d && d.kind === BACKUP_KIND && Array.isArray(d.sheets)) return d.sheets.filter(isSheet);
  return [];
}
export const markBackup = () => { try { localStorage.setItem('last-backup', String(Date.now())); localStorage.removeItem('backup-snooze'); } catch { /* */ } };
export function backupDue(count: number): boolean {
  if (!count) return false;
  try {
    const last = Number(localStorage.getItem('last-backup') || 0), snooze = Number(localStorage.getItem('backup-snooze') || 0);
    const first = Number(localStorage.getItem('first-seen') || 0) || (localStorage.setItem('first-seen', String(Date.now())), Date.now());
    const week = 7 * 864e5; const now = Date.now();
    return now - Math.max(last, first) > week && now > snooze;
  } catch { return false; }
}
export const snoozeBackup = () => { try { localStorage.setItem('backup-snooze', String(Date.now() + 7 * 864e5)); } catch { /* */ } };

/* ---------- ссылка на лист ---------- */
const b64u = (u8: Uint8Array) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function pipe(data: Uint8Array, t: CompressionStream | DecompressionStream) { return new Uint8Array(await new Response(new Blob([data as BlobPart]).stream().pipeThrough(t as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)).arrayBuffer()); }
/** Картинки (портрет, своя эмблема) в ссылку не кладём — она стала бы слишком длинной. */
export function stripImages(s: Sheet): Sheet {
  return { ...s, emblem: s.emblem?.startsWith('data:') ? undefined : s.emblem, pages: s.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.type === 'image' && b.value?.startsWith('data:') ? { ...b, value: '' } : b)) })) };
}
export async function shareLink(s: Sheet): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(stripImages(s)));
  const z = typeof CompressionStream !== 'undefined';
  const body = z ? await pipe(raw, new CompressionStream('deflate-raw')) : raw;
  return `${location.origin}${import.meta.env.BASE_URL}#share=${z ? 'z' : 'p'}${b64u(body)}`;
}
export async function sheetFromLink(hash: string): Promise<Sheet | null> {
  const m = hash.match(/#share=([zp])(.+)$/); if (!m) return null;
  try {
    const bytes = unb64u(m[2]!);
    const raw = m[1] === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
    const s = JSON.parse(new TextDecoder().decode(raw));
    return isSheet(s) ? s : null;
  } catch { return null; }
}
