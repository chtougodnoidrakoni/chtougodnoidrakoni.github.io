/** Состояние: список листов, открытый лист, режим, выделение, история отмен, база заклинаний. */
import { create } from 'zustand';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { migrateLayout } from './layout';
import { clubTemplate, migrateSheet, sheetName, uid, type Block, type GameSystem, type Page, type Sheet, type SpellData } from './model';

export interface SheetMeta { id: string; name: string; updatedAt: number; system?: GameSystem }
const meta = (s: Sheet): SheetMeta => ({ id: s.id, name: sheetName(s), updatedAt: s.updatedAt, system: s.system ?? 'dnd' });

interface State {
  ready: boolean;
  index: SheetMeta[];
  sheet?: Sheet;
  pageIdx: number;
  /** страница, открытая в редакторе (карандаш у страницы) */
  editPage?: string;
  selected?: string;
  /** блок, открытый в окне заполнения */
  filling?: string;
  past: Sheet[];
  future: Sheet[];
  spells: SpellData[];
  spellMap: Map<string, SpellData>;
  toast?: string;
  picker?: { min: number; max: number };
  boot(): Promise<void>;
  open(id: string): Promise<void>;
  close(): void;
  create(from?: Sheet): Promise<string>;
  remove(id: string): Promise<void>;
  /** изменение с записью в историю (макет) */
  commit(fn: (s: Sheet) => Sheet): void;
  /** изменение содержимого без записи в историю (заполнение) */
  edit(fn: (s: Sheet) => Sheet): void;
  updateBlock(id: string, patch: Partial<Block>, history?: boolean): void;
  updatePage(patch: Partial<Page>): void;
  undo(): void;
  redo(): void;
  setEditPage(id?: string): void;
  fill(id?: string): void;
  select(id?: string): void;
  setPage(i: number): void;
  say(t: string): void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist(s: Sheet) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await idbSet(`sheet:${s.id}`, s);
    const index: SheetMeta[] = (await idbGet('index')) ?? [];
    const next = [meta(s), ...index.filter((x) => x.id !== s.id)];
    await idbSet('index', next);
    useStore.setState({ index: next });
  }, 400);
}

export const useStore = create<State>((set, get) => ({
  ready: false, index: [], pageIdx: 0, past: [], future: [], spells: [], spellMap: new Map(),

  async boot() {
    let index: SheetMeta[] = (await idbGet('index').catch(() => undefined)) ?? [];
    // старые записи без игры: узнаём её из самого листа
    const stale = (m: SheetMeta) => !m.system || m.name === 'Новый персонаж';
    if (index.some(stale)) {
      index = await Promise.all(index.map(async (m) => {
        if (!stale(m)) return m;
        const sh: Sheet | undefined = await idbGet(`sheet:${m.id}`).catch(() => undefined);
        return sh ? { ...m, name: sheetName(sh), system: sh.system ?? 'dnd' } : { ...m, system: m.system ?? 'dnd' };
      }));
      await idbSet('index', index).catch(() => {});
    }
    set({ index, ready: true });
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}spells.json`);
      const spells: SpellData[] = await res.json();
      set({ spells, spellMap: new Map(spells.map((s) => [s.id, s])) });
    } catch { /* без сети и кэша — работаем без базы */ }
  },
  async open(id) {
    const raw: Sheet | undefined = await idbGet(`sheet:${id}`);
    const sheet = raw ? migrateLayout(migrateSheet(raw)) : undefined;
    if (sheet) set({ sheet, pageIdx: 0, past: [], future: [], selected: undefined, editPage: undefined, filling: undefined });
    location.hash = sheet ? `sheet/${id}` : '';
  },
  close() { set({ sheet: undefined, selected: undefined, editPage: undefined, filling: undefined }); location.hash = ''; },
  async create(from) {
    const s: Sheet = from ? { ...structuredClone(from), id: uid(), updatedAt: Date.now() } : clubTemplate();
    await idbSet(`sheet:${s.id}`, s);
    const index = [meta(s), ...get().index];
    await idbSet('index', index);
    set({ index });
    return s.id;
  },
  async remove(id) {
    await idbDel(`sheet:${id}`);
    const index = get().index.filter((x) => x.id !== id);
    await idbSet('index', index);
    set({ index });
  },
  commit(fn) {
    const cur = get().sheet; if (!cur) return;
    const next = { ...fn(structuredClone(cur)), updatedAt: Date.now() };
    set({ sheet: next, past: [...get().past.slice(-60), cur], future: [] });
    persist(next);
  },
  edit(fn) {
    const cur = get().sheet; if (!cur) return;
    const next = { ...fn(cur), updatedAt: Date.now() };
    set({ sheet: next });
    persist(next);
  },
  updateBlock(id, patch, history = false) {
    const fn = (s: Sheet) => ({ ...s, pages: s.pages.map((p) => (p.blocks.some((b) => b.id === id) ? { ...p, blocks: p.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) } : p)) });
    if (history) get().commit(fn); else get().edit(fn);
  },
  updatePage(patch) { get().commit((s) => ({ ...s, pages: s.pages.map((p, i) => (i === get().pageIdx ? { ...p, ...patch } : p)) })); },
  undo() {
    const { past, sheet, future } = get(); if (!past.length || !sheet) return;
    const prev = past[past.length - 1]!;
    set({ sheet: prev, past: past.slice(0, -1), future: [sheet, ...future], pageIdx: Math.min(get().pageIdx, prev.pages.length - 1) });
    persist(prev);
  },
  redo() {
    const { past, sheet, future } = get(); if (!future.length || !sheet) return;
    const next = future[0]!;
    set({ sheet: next, past: [...past, sheet], future: future.slice(1) });
    persist(next);
  },
  setEditPage(editPage) { set({ editPage, selected: undefined }); },
  fill(filling) { set({ filling }); },
  select(selected) { set({ selected }); },
  setPage(pageIdx) { if (get().pageIdx !== pageIdx) set({ pageIdx }); },
  say(toast) { set({ toast }); setTimeout(() => { if (get().toast === toast) set({ toast: undefined }); }, 2600); },
}));
