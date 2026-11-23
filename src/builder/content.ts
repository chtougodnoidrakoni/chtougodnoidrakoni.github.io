/**
 * Библиотека контента: пакеты классов и подклассов в формате dnd-content-pack.
 * Файл — это только данные (JSON внутри .txt). Ничего из него не исполняется:
 * всё проверяется валидатором и превращается во внутренние структуры сборщика.
 */
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { ABS, CLASSES, type Ab, type ClassDef, type Ed } from './data';

export const FORMAT = 'dnd-content-pack';
export const FORMAT_VERSION = 1;
export const MAX_BYTES = 8 * 1024 * 1024;

// ------------------------------------------------------------------ формат файла
export type Ruleset = '5e-2014' | '5e-2024';
export type Recharge = 'short' | 'long' | 'dawn' | 'none';
export type Uses = number | { by_level: Record<string, number> } | { ability: string; min?: number } | { proficiency: true } | { per_level: number };
export type Effect =
  | { type: 'hp_per_level'; value: number }
  | { type: 'unarmored_ac'; base: number; abilities: string[]; shield?: boolean }
  | { type: 'speed'; value: number; condition?: 'no_armor' | 'no_heavy_armor' }
  | { type: 'armor_proficiency'; value: ('light' | 'medium' | 'heavy' | 'shields')[] }
  | { type: 'weapon_proficiency'; value: string[] }
  | { type: 'skill_proficiency'; value: string[] }
  | { type: 'save_proficiency'; value: string[] }
  | { type: 'expertise'; count: number }
  | { type: 'note'; text: string };
export interface FeatureIn {
  id: string; name: string; name_en?: string; level: number; description?: string; effect?: string;
  action?: 'action' | 'bonus' | 'reaction' | 'passive' | 'other'; range?: string; duration?: string; trigger?: string; limits?: string;
  uses?: Uses; recharge?: Recharge; ability?: string; scaling?: string; formula?: string; interactions?: string; source?: string;
  effects?: Effect[];
}
export interface SpellcastingIn {
  ability: string; kind: 'known' | 'prepared' | 'book';
  progression: 'full' | 'half' | 'half_up' | 'third' | 'pact' | 'custom'; slots?: number[][];
  cantrips?: number[]; spells_known?: number[]; prepared?: { base: 'level' | 'half_level' | 'half_level_up' | 'third_level'; min?: number }; prepared_table?: number[];
  spell_list?: string;
}
export interface SubclassIn {
  id: string; class_id: string; name: string; name_en?: string; source?: string; summary?: string; description?: string;
  level?: number; features: FeatureIn[]; spells?: { level: number; spells: string[] }[]; restrictions?: string;
}
export interface ClassIn {
  id: string; name: string; name_en?: string; source?: string; summary?: string; description?: string; role?: string;
  primary_abilities?: string[]; hit_die: number; saving_throws: string[];
  armor_proficiencies?: ('light' | 'medium' | 'heavy' | 'shields')[]; armor_text?: string;
  weapon_proficiencies?: { simple?: boolean; martial?: boolean; list?: string[] }; tool_proficiencies?: string;
  skills: { choose: number; from: string[] | 'any' }; starting_equipment?: string | string[];
  subclass_level: number; subclass_title?: string; asi_levels?: number[];
  spellcasting?: SpellcastingIn; progression?: { level: number; notes?: string }[];
  features: FeatureIn[]; subclasses?: SubclassIn[];
}
export interface PackIn {
  format: string; format_version: number; ruleset: Ruleset; pack_id: string; pack_name: string; pack_version?: number;
  language?: string; author?: string; description?: string; sources?: { id: string; name: string }[];
  classes?: ClassIn[]; subclasses?: SubclassIn[];
}

// ------------------------------------------------------------------ хранилище
export interface StoredPack { pack: PackIn; enabled: boolean; importedAt: number; file?: string; origin: 'local' | 'club' }
export interface LogEntry { at: number; file: string; pack: string; result: string; who: string }
const KEY = 'content-packs', PREV = 'content-packs-prev', LOG = 'content-log';

const ID = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const AB_EN: Record<string, Ab> = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha', str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha', сила: 'str', ловкость: 'dex', телосложение: 'con', интеллект: 'int', мудрость: 'wis', харизма: 'cha' };
export const abOf = (s: string | undefined): Ab | undefined => (s ? AB_EN[s.toLowerCase().trim()] : undefined);
const AB_NAME: Record<Ab, string> = { str: 'Сила', dex: 'Ловкость', con: 'Телосложение', int: 'Интеллект', wis: 'Мудрость', cha: 'Харизма' };

// ------------------------------------------------------------------ проверка
export interface Report {
  ok: boolean; pack?: PackIn; errors: string[]; warnings: string[];
  stats: { classes: number; subclasses: number; features: number; newClasses: string[]; newSubclasses: string[]; updated: string[]; duplicates: string[] };
  mode?: 'new' | 'update' | 'same' | 'older';
}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** Читает текст файла: чистый JSON или JSON с пояснениями сверху (берём от первой строки, начинающейся с {, до последней }). */
export function readPack(text: string): { data?: unknown; error?: string } {
  if (text.length > MAX_BYTES) return { error: `Файл больше ${MAX_BYTES / 1024 / 1024} МБ` };
  const t = text.replace(/^﻿/, '').trim();
  const m = t.search(/^\{/m); const a = m >= 0 ? m : t.indexOf('{'), z = t.lastIndexOf('}');
  if (a < 0 || z < a) return { error: 'В файле нет JSON-объекта: он должен начинаться с { и заканчиваться }' };
  try { return { data: JSON.parse(t.slice(a, z + 1)) }; } catch (e) { return { error: `JSON с ошибкой: ${(e as Error).message}` }; }
}

function checkFeature(f: unknown, where: string, e: string[], w: string[], ids: Set<string>): number {
  const x = f as FeatureIn;
  if (!x || typeof x !== 'object') { e.push(`${where}: способность должна быть объектом`); return 0; }
  if (!x.id || !ID.test(x.id)) e.push(`${where}: неверный id способности «${x.id ?? ''}» (латиница, цифры, _ и -)`);
  else if (ids.has(x.id)) e.push(`${where}: id способности «${x.id}» повторяется`); else ids.add(x.id);
  if (!x.name?.trim()) e.push(`${where} › ${x.id}: нет названия`);
  if (!isNum(x.level) || x.level < 1 || x.level > 20) e.push(`${where} › ${x.id}: уровень должен быть от 1 до 20`);
  if (!x.description?.trim() && !x.effect?.trim()) w.push(`${where} › ${x.name ?? x.id}: нет описания`);
  if (x.recharge && !['short', 'long', 'dawn', 'none'].includes(x.recharge)) e.push(`${where} › ${x.id}: recharge может быть short, long, dawn или none`);
  if (x.action && !['action', 'bonus', 'reaction', 'passive', 'other'].includes(x.action)) e.push(`${where} › ${x.id}: action может быть action, bonus, reaction, passive или other`);
  for (const ef of arr(x.effects)) {
    const t = (ef as Effect)?.type;
    if (!['hp_per_level', 'unarmored_ac', 'speed', 'armor_proficiency', 'weapon_proficiency', 'skill_proficiency', 'save_proficiency', 'expertise', 'note'].includes(t)) e.push(`${where} › ${x.id}: неизвестный эффект «${t}»`);
    if (t === 'unarmored_ac' && arr((ef as { abilities: unknown }).abilities).some((a) => !abOf(String(a)))) e.push(`${where} › ${x.id}: unarmored_ac — неизвестная характеристика`);
  }
  return 1;
}
function table20(v: unknown, name: string, where: string, e: string[]) {
  if (v === undefined) return;
  if (!Array.isArray(v) || v.length !== 20) e.push(`${where}: ${name} — нужен список из 20 значений (по уровням 1–20)`);
}

export function validate(raw: unknown, existing: StoredPack[] = []): Report {
  const errors: string[] = [], warnings: string[] = [];
  const stats: Report['stats'] = { classes: 0, subclasses: 0, features: 0, newClasses: [], newSubclasses: [], updated: [], duplicates: [] };
  const p = raw as PackIn;
  const fail = (m: string) => ({ ok: false, errors: [m], warnings, stats });
  if (!p || typeof p !== 'object' || Array.isArray(p)) return fail('Корень файла должен быть объектом { … }');
  if (p.format !== FORMAT) return fail(`Поле format должно быть «${FORMAT}»`);
  if (p.format_version !== FORMAT_VERSION) return fail(`Поддерживается format_version ${FORMAT_VERSION}, в файле ${String(p.format_version)}`);
  if (p.ruleset !== '5e-2014' && p.ruleset !== '5e-2024') return fail('ruleset должен быть «5e-2014» или «5e-2024»');
  if (!p.pack_id || !ID.test(p.pack_id)) errors.push('pack_id обязателен: латиница, цифры, _ и -');
  if (!p.pack_name?.trim()) errors.push('pack_name обязателен');
  if (p.pack_version !== undefined && (!Number.isInteger(p.pack_version) || p.pack_version < 1)) errors.push('pack_version — целое число от 1');
  const ed: Ed = p.ruleset === '5e-2014' ? '2014' : '2024';
  const featIds = new Set<string>(); const classIds = new Set<string>(); const subIds = new Set<string>();
  const others = existing.filter((s) => s.pack.pack_id !== p.pack_id && s.enabled && s.pack.ruleset === p.ruleset);
  const otherClasses = new Map<string, string>(); const otherSubs = new Map<string, string>();
  for (const s of others) { for (const c of s.pack.classes ?? []) otherClasses.set(c.id, s.pack.pack_name); for (const sc of allSubs(s.pack)) otherSubs.set(sc.id, s.pack.pack_name); }
  const builtIn = new Set(CLASSES.map((c) => c.id));

  const classes = arr(p.classes) as ClassIn[];
  for (const c of classes) {
    const where = `Класс ${c?.name ?? c?.id ?? '?'}`;
    if (!c || typeof c !== 'object') { errors.push('Класс должен быть объектом'); continue; }
    stats.classes++;
    if (!c.id || !ID.test(c.id)) errors.push(`${where}: неверный id «${c.id ?? ''}»`);
    else if (classIds.has(c.id)) { errors.push(`${where}: id «${c.id}» повторяется в файле`); stats.duplicates.push(c.id); }
    else classIds.add(c.id);
    if (!c.name?.trim()) errors.push(`${where}: нет русского названия (name)`);
    if (![6, 8, 10, 12].includes(c.hit_die)) errors.push(`${where}: hit_die должен быть 6, 8, 10 или 12`);
    if (!Array.isArray(c.saving_throws) || c.saving_throws.length !== 2 || c.saving_throws.some((a) => !abOf(a))) errors.push(`${where}: saving_throws — две характеристики (strength, dexterity…)`);
    if (!c.skills || !isNum(c.skills.choose) || (c.skills.from !== 'any' && !Array.isArray(c.skills.from))) errors.push(`${where}: skills = { choose: число, from: [навыки] или "any" }`);
    if (!isNum(c.subclass_level) || c.subclass_level < 1 || c.subclass_level > 20) errors.push(`${where}: subclass_level от 1 до 20`);
    for (const l of arr(c.asi_levels)) if (!isNum(l) || (l as number) < 1 || (l as number) > 20) errors.push(`${where}: asi_levels — уровни от 1 до 20`);
    if (!Array.isArray(c.features)) errors.push(`${where}: features — список способностей`);
    for (const f of arr(c.features)) stats.features += checkFeature(f, where, errors, warnings, featIds);
    const sc = c.spellcasting;
    if (sc) {
      if (!abOf(sc.ability)) errors.push(`${where}: spellcasting.ability — характеристика`);
      if (!['known', 'prepared', 'book'].includes(sc.kind)) errors.push(`${where}: spellcasting.kind — known, prepared или book`);
      if (!['full', 'half', 'half_up', 'third', 'pact', 'custom'].includes(sc.progression)) errors.push(`${where}: spellcasting.progression — full, half, half_up, third, pact или custom`);
      if (sc.progression === 'custom' && !sc.slots) errors.push(`${where}: при progression «custom» нужна таблица slots`);
      table20(sc.slots, 'slots', where, errors); table20(sc.cantrips, 'cantrips', where, errors); table20(sc.spells_known, 'spells_known', where, errors); table20(sc.prepared_table, 'prepared_table', where, errors);
      if (sc.kind === 'known' && !sc.spells_known) errors.push(`${where}: для kind «known» нужна таблица spells_known`);
      if (sc.kind !== 'known' && !sc.prepared && !sc.prepared_table) errors.push(`${where}: для подготовки нужна формула prepared или таблица prepared_table`);
    }
    if (builtIn.has(c.id)) warnings.push(`${where}: заменит встроенный класс «${CLASSES.find((x) => x.id === c.id)!.name}» на время, пока пакет включён`);
    if (otherClasses.has(c.id)) warnings.push(`${where}: такой класс уже есть в пакете «${otherClasses.get(c.id)}»`);
    else stats.newClasses.push(c.name);
  }
  const knownClasses = new Set([...classIds, ...builtIn, ...otherClasses.keys()]);
  for (const s of allSubs(p)) {
    const where = `Подкласс ${s?.name ?? s?.id ?? '?'}`;
    if (!s || typeof s !== 'object') { errors.push('Подкласс должен быть объектом'); continue; }
    stats.subclasses++;
    if (!s.id || !ID.test(s.id)) errors.push(`${where}: неверный id «${s.id ?? ''}»`);
    else if (subIds.has(s.id)) { errors.push(`${where}: id «${s.id}» повторяется в файле`); stats.duplicates.push(s.id); }
    else subIds.add(s.id);
    if (!s.name?.trim()) errors.push(`${where}: нет названия`);
    if (!s.class_id) errors.push(`${where}: нет class_id`);
    else if (!knownClasses.has(s.class_id)) errors.push(`${where}: класс «${s.class_id}» не найден ни в файле, ни в сборщике`);
    if (s.class_id && subIds.has(s.class_id)) errors.push(`${where}: class_id указывает на подкласс — циклическая ссылка`);
    if (s.level !== undefined && (!isNum(s.level) || s.level < 1 || s.level > 20)) errors.push(`${where}: level от 1 до 20`);
    if (!Array.isArray(s.features) || !s.features.length) errors.push(`${where}: нужен список features`);
    for (const f of arr(s.features)) stats.features += checkFeature(f, where, errors, warnings, featIds);
    for (const g of arr(s.spells)) { const x = g as { level: number; spells: unknown }; if (!isNum(x?.level) || x.level < 1 || x.level > 20 || !Array.isArray(x.spells)) errors.push(`${where}: spells — [{ level: 1–20, spells: [названия] }]`); }
    const clsLvl = classes.find((c) => c.id === s.class_id)?.subclass_level ?? subAtFor(s.class_id, ed);
    if (s.level === undefined && clsLvl && arr(s.features).some((f) => (f as FeatureIn).level < clsLvl)) warnings.push(`${where}: есть способности раньше уровня выбора подкласса (${clsLvl})`);
    if (otherSubs.has(s.id)) warnings.push(`${where}: уже есть в пакете «${otherSubs.get(s.id)}»`);
    else stats.newSubclasses.push(s.name);
  }
  if (!stats.classes && !stats.subclasses) errors.push('В пакете нет ни классов, ни подклассов');
  const old = existing.find((s) => s.pack.pack_id === p.pack_id);
  let mode: Report['mode'] = 'new';
  if (old) {
    const ov = old.pack.pack_version ?? 1, nv = p.pack_version ?? 1;
    if (JSON.stringify(old.pack) === JSON.stringify(p)) { mode = 'same'; warnings.push('Этот пакет уже импортирован без изменений — повторный импорт ничего не добавит'); }
    else if (nv > ov) { mode = 'update'; stats.updated.push(`${p.pack_name}: версия ${ov} → ${nv}`); }
    else if (nv === ov) { mode = 'update'; warnings.push(`Пакет той же версии ${nv}, но содержимое отличается — записи с теми же id обновятся`); stats.updated.push(p.pack_name); }
    else { mode = 'older'; warnings.push(`В приложении версия ${ov}, а в файле старее — ${nv}`); }
    const oldIds = new Set([...(old.pack.classes ?? []).map((c) => c.id), ...allSubs(old.pack).map((s) => s.id)]);
    stats.newClasses = (p.classes ?? []).filter((c) => !oldIds.has(c.id)).map((c) => c.name);
    stats.newSubclasses = allSubs(p).filter((s) => !oldIds.has(s.id)).map((s) => s.name);
    stats.updated.push(...[...(p.classes ?? []), ...allSubs(p)].filter((x) => oldIds.has(x.id)).map((x) => x.name));
  }
  return { ok: errors.length === 0, pack: p, errors, warnings, stats, mode };
}

export const allSubs = (p: PackIn): SubclassIn[] => [...(p.subclasses ?? []), ...(p.classes ?? []).flatMap((c) => (c.subclasses ?? []).map((s) => ({ ...s, class_id: s.class_id ?? c.id })))];
const subAtFor = (classId: string, ed: Ed) => { const c = CLASSES.find((x) => x.id === classId); return c ? (ed === '2014' ? c.sub.at14 : c.sub.at24) : undefined; };

// ------------------------------------------------------------------ загрузка, сохранение, откат
export async function loadLocal(): Promise<StoredPack[]> { return ((await idbGet(KEY).catch(() => undefined)) as StoredPack[] | undefined) ?? []; }
export async function loadLog(): Promise<LogEntry[]> { return ((await idbGet(LOG).catch(() => undefined)) as LogEntry[] | undefined) ?? []; }
async function log(e: LogEntry) { const l = await loadLog(); await idbSet(LOG, [e, ...l].slice(0, 200)); }

/** Сохраняет весь список пакетов одной записью — либо всё, либо ничего. Прошлое состояние остаётся для отката. */
async function commit(list: StoredPack[]) { await idbSet(PREV, await loadLocal()); await idbSet(KEY, list); }

export async function importPack(p: PackIn, file: string): Promise<StoredPack[]> {
  const list = await loadLocal();
  const rep = validate(p, list);
  if (!rep.ok) throw new Error(rep.errors[0]);
  const next = [...list.filter((s) => s.pack.pack_id !== p.pack_id), { pack: p, enabled: true, importedAt: Date.now(), file, origin: 'local' as const }];
  await commit(next);
  await log({ at: Date.now(), file, pack: `${p.pack_name} (${p.pack_id} v${p.pack_version ?? 1})`, result: `${rep.mode === 'new' ? 'добавлен' : 'обновлён'}: классов ${rep.stats.classes}, подклассов ${rep.stats.subclasses}, способностей ${rep.stats.features}`, who: 'это устройство' });
  return next;
}
export async function setEnabled(id: string, enabled: boolean) { const l = await loadLocal(); const n = l.map((s) => (s.pack.pack_id === id ? { ...s, enabled } : s)); await commit(n); return n; }
export async function removePack(id: string) { const l = await loadLocal(); const n = l.filter((s) => s.pack.pack_id !== id); await commit(n); await log({ at: Date.now(), file: '', pack: id, result: 'удалён с устройства', who: 'это устройство' }); return n; }
export async function undoLast() { const prev = ((await idbGet(PREV)) as StoredPack[] | undefined) ?? []; await idbSet(KEY, prev); await log({ at: Date.now(), file: '', pack: '—', result: 'откат последнего изменения', who: 'это устройство' }); return prev; }

/** Пакеты клуба лежат на сайте: content/index.json → список файлов. */
export async function loadClub(base: string): Promise<StoredPack[]> {
  try {
    const idx = await (await fetch(`${base}content/index.json`, { cache: 'no-cache' })).json() as { packs?: string[] };
    const out: StoredPack[] = [];
    for (const f of idx.packs ?? []) {
      if (!/^[a-z0-9_-]+\.json$/.test(f)) continue;
      try { const p = await (await fetch(`${base}content/packs/${f}`, { cache: 'no-cache' })).json() as PackIn; if (validate(p).ok) out.push({ pack: p, enabled: true, importedAt: 0, file: f, origin: 'club' }); } catch { /* битый файл пропускаем */ }
    }
    return out;
  } catch { return []; }
}

// ------------------------------------------------------------------ реестр для сборщика
export interface FeatureDef { id: string; name: string; level: number; text: string; uses?: Uses; recharge?: Recharge; effects: Effect[]; action?: string; source?: string }
export interface SubDef { id: string; classId: string; name: string; source: string; pack?: string; level?: number; features: FeatureDef[]; spells: { level: number; spells: string[] }[]; summary?: string }
export interface SpellDef { ability: Ab; kind: 'known' | 'prepared' | 'book'; progression: SpellcastingIn['progression']; slots?: number[][]; cantrips?: number[]; known?: number[]; prepared?: SpellcastingIn['prepared']; preparedTable?: number[]; list: string }

let active: StoredPack[] = [];
let cache: { classes: Record<Ed, ClassDef[]>; subs: Record<Ed, SubDef[]> } | undefined;
export function setActive(packs: StoredPack[]) { active = packs; cache = undefined; }
export const activePacks = () => active;

const toFeature = (f: FeatureIn, src: string): FeatureDef => ({
  id: f.id, name: f.name, level: f.level, source: f.source ?? src, uses: f.uses, recharge: f.recharge, effects: f.effects ?? [], action: f.action,
  text: [f.description, f.effect && f.effect !== f.description ? f.effect : '', f.range ? `Дальность: ${f.range}.` : '', f.duration ? `Длительность: ${f.duration}.` : '', f.limits ? `Ограничения: ${f.limits}.` : '', f.scaling ? `Рост: ${f.scaling}.` : ''].filter(Boolean).join(' '),
});

function toClass(c: ClassIn, p: PackIn, ed: Ed): ClassDef {
  const armorKinds = (c.armor_proficiencies ?? []).filter((x): x is 'light' | 'medium' | 'heavy' => x !== 'shields');
  const wp = c.weapon_proficiencies ?? {};
  const weapons: ClassDef['weapons'] = wp.martial ? 'martial' : wp.simple && !wp.list?.length ? 'simple' : [...(wp.list ?? [])];
  const byLvl: Record<number, string[]> = {};
  for (const f of c.features) (byLvl[f.level] ??= []).push(f.name);
  for (let l = c.subclass_level; l <= 20; l++) if (l === c.subclass_level) (byLvl[l] ??= []).push(`${c.subclass_title ?? 'Подкласс'} — выбор подкласса`);
  const sc = c.spellcasting;
  const caster: ClassDef['caster'] = sc ? (sc.progression === 'pact' ? 'pact' : sc.progression === 'full' ? 'full' : 'half') : undefined;
  const src = c.source ?? p.pack_name;
  return {
    id: c.id, name: c.name, hd: c.hit_die, primary: (c.primary_abilities ?? []).map((a) => AB_NAME[abOf(a) ?? 'str']).join(' и ') || '—',
    saves: c.saving_throws.map((a) => abOf(a)!), skills: { n: c.skills.choose, from: c.skills.from },
    armor: c.armor_text ?? ((c.armor_proficiencies ?? []).map((x) => ({ light: 'лёгкие', medium: 'средние', heavy: 'тяжёлые', shields: 'щиты' }[x])).join(', ') || 'нет'),
    shields: (c.armor_proficiencies ?? []).includes('shields'), armorKinds, weapons, weapons24: weapons === 'martial' ? 'martial' : weapons === 'simple' ? 'simple' : undefined,
    tools: c.tool_proficiencies, caster, spellAb: sc ? abOf(sc.ability) : undefined, spellKind: sc?.kind,
    sub: { at14: c.subclass_level, at24: c.subclass_level, name14: '', name24: '', title: c.subclass_title ?? 'Подкласс' },
    asi14: c.asi_levels ?? [4, 8, 12, 16, 19], asi24: (c.asi_levels ?? [4, 8, 12, 16]).filter((l) => l !== 19),
    feat14: byLvl, feat24: byLvl, kit: Array.isArray(c.starting_equipment) ? c.starting_equipment.join(', ') : c.starting_equipment ?? '',
    source: src, pack: p.pack_name, summary: c.summary, fdefs: c.features.map((f) => toFeature(f, src)),
    spellDef: sc ? { ability: abOf(sc.ability)!, kind: sc.kind, progression: sc.progression, slots: sc.slots, cantrips: sc.cantrips, known: sc.spells_known, prepared: sc.prepared, preparedTable: sc.prepared_table, list: sc.spell_list ?? c.id } : undefined,
    ...(ed ? {} : {}),
  };
}

function build() {
  const classes: Record<Ed, ClassDef[]> = { '2014': [...CLASSES], '2024': [...CLASSES] };
  const subs: Record<Ed, SubDef[]> = { '2014': [], '2024': [] };
  for (const s of active) {
    if (!s.enabled) continue;
    const ed: Ed = s.pack.ruleset === '5e-2014' ? '2014' : '2024';
    for (const c of s.pack.classes ?? []) {
      const def = toClass(c, s.pack, ed);
      const i = classes[ed].findIndex((x) => x.id === c.id);
      if (i >= 0) classes[ed][i] = def; else classes[ed].push(def);
    }
    for (const sc of allSubs(s.pack)) {
      const src = sc.source ?? s.pack.pack_name;
      const d: SubDef = { id: `${s.pack.pack_id}:${sc.id}`, classId: sc.class_id, name: sc.name, source: src, pack: s.pack.pack_name, level: sc.level, features: sc.features.map((f) => toFeature(f, src)), spells: sc.spells ?? [], summary: sc.summary };
      subs[ed] = [...subs[ed].filter((x) => x.id !== d.id), d];
    }
  }
  return { classes, subs };
}
export function classesFor(ed: Ed): ClassDef[] { return (cache ??= build()).classes[ed]; }
export function subsFor(ed: Ed, classId: string): SubDef[] { return (cache ??= build()).subs[ed].filter((s) => s.classId === classId); }
export function findSub(ed: Ed, id?: string): SubDef | undefined { return id ? (cache ??= build()).subs[ed].find((s) => s.id === id) : undefined; }

/** Число применений способности на уровне. */
export function usesAt(u: Uses | undefined, level: number, mods: Record<Ab, number>, pb: number): number | undefined {
  if (u === undefined) return undefined;
  if (typeof u === 'number') return u;
  if ('by_level' in u) { let v: number | undefined; for (const [l, n] of Object.entries(u.by_level)) if (+l <= level) v = n; return v; }
  if ('ability' in u) { const a = abOf(u.ability); return a ? Math.max(u.min ?? 1, mods[a]) : undefined; }
  if ('proficiency' in u) return pb;
  if ('per_level' in u) return u.per_level * level;
  return undefined;
}

// ------------------------------------------------------------------ экспорт
/** Встроенные классы сборщика в формате пакета — как отправная точка для своих файлов. */
export function exportBuiltIn(ed: Ed): PackIn {
  return {
    format: FORMAT, format_version: FORMAT_VERSION, ruleset: ed === '2014' ? '5e-2014' : '5e-2024', pack_id: `builtin_${ed}`, pack_name: `Встроенные классы сборщика (${ed})`, pack_version: 1, language: 'ru',
    description: 'Выгрузка встроенных классов: названия умений по уровням, без описаний.',
    classes: CLASSES.map((c) => {
      const feat = ed === '2014' ? c.feat14 : c.feat24; let n = 0;
      return {
        id: c.id, name: c.name, source: ed === '2014' ? 'SRD 5.1' : 'SRD 5.2', hit_die: c.hd, saving_throws: c.saves.map((a) => ({ str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' }[a])),
        armor_proficiencies: [...c.armorKinds, ...(c.shields ? ['shields' as const] : [])], armor_text: c.armor, tool_proficiencies: c.tools,
        weapon_proficiencies: c.weapons === 'martial' ? { simple: true, martial: true } : c.weapons === 'simple' ? { simple: true } : { list: c.weapons as string[] },
        skills: { choose: c.skills.n, from: c.skills.from }, starting_equipment: c.kit, subclass_level: ed === '2014' ? c.sub.at14 : c.sub.at24, subclass_title: c.sub.title,
        asi_levels: ed === '2014' ? c.asi14 : c.asi24,
        features: Object.entries(feat).flatMap(([l, list]) => list.filter((x) => !x.startsWith('★') && !x.endsWith('выбор подкласса')).map((name) => ({ id: `${c.id}_${++n}`, name, level: +l }))),
      };
    }),
  };
}
export const packText = (p: PackIn) => JSON.stringify(p, null, 2);
export { ABS };
