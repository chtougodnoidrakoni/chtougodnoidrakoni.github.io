/** Повышение уровня D&D 5e по открытым правилам SRD 5.1 (2014). Один класс, без мультикласса. */
import { abilityMod, calcSheet, keyOf, uid, type Block, type Charge, type Sheet } from './model';

type Caster = 'full' | 'half' | 'pact' | undefined;
interface Cls { id: string; names: string[]; hd: number; caster: Caster; asi: number[]; feat: Record<number, string[]>; charge?: { name: string; at: (l: number) => number | undefined; reset: Charge['reset'] } }
const ASI = [4, 8, 12, 16, 19];
const sub = (n: string) => `умение подкласса (${n})`;

export const CLASSES: Cls[] = [
  { id: 'barbarian', names: ['варвар'], hd: 12, caster: undefined, asi: ASI, charge: { name: 'Ярость', reset: 'long', at: (l) => (l >= 20 ? 99 : l >= 17 ? 6 : l >= 12 ? 5 : l >= 6 ? 4 : l >= 3 ? 3 : 2) },
    feat: { 1: ['Ярость', 'Защита без доспехов'], 2: ['Безрассудная атака', 'Чувство опасности'], 3: ['Путь дикости — выбор подкласса'], 5: ['Дополнительная атака', 'Быстрое передвижение'], 6: [sub('путь')], 7: ['Дикий инстинкт'], 9: ['Сильный критический удар (1 кость)'], 10: [sub('путь')], 11: ['Непреклонная ярость'], 13: ['Сильный критический удар (2 кости)'], 14: [sub('путь')], 15: ['Непрерывная ярость'], 17: ['Сильный критический удар (3 кости)'], 18: ['Неукротимая мощь'], 20: ['Первобытный чемпион: СИЛ и ТЕЛ +4 (максимум 24)'] } },
  { id: 'bard', names: ['бард'], hd: 8, caster: 'full', asi: ASI, charge: { name: 'Вдохновение барда', reset: 'long', at: () => undefined },
    feat: { 1: ['Вдохновение барда (к6)', 'Использование заклинаний'], 2: ['Мастер на все руки', 'Песнь отдыха (к6)'], 3: ['Коллегия бардов — выбор подкласса', 'Компетентность'], 5: ['Вдохновение барда (к8)', 'Источник вдохновения: восстанавливается коротким отдыхом'], 6: ['Контрочарование', sub('коллегия')], 9: ['Песнь отдыха (к8)'], 10: ['Вдохновение барда (к10)', 'Компетентность', 'Тайны магии'], 13: ['Песнь отдыха (к10)'], 14: ['Тайны магии', sub('коллегия')], 15: ['Вдохновение барда (к12)'], 17: ['Песнь отдыха (к12)'], 18: ['Тайны магии'], 20: ['Превосходное вдохновение'] } },
  { id: 'cleric', names: ['жрец', 'клирик'], hd: 8, caster: 'full', asi: ASI,
    feat: { 1: ['Использование заклинаний', 'Божественный домен — выбор подкласса'], 2: ['Божественный канал (1 раз за отдых)', sub('домен')], 5: ['Уничтожение нежити (ПО 1/2)'], 6: ['Божественный канал (2 раза за отдых)', sub('домен')], 8: ['Уничтожение нежити (ПО 1)', sub('домен')], 10: ['Божественное вмешательство'], 11: ['Уничтожение нежити (ПО 2)'], 14: ['Уничтожение нежити (ПО 3)'], 17: ['Уничтожение нежити (ПО 4)', sub('домен')], 18: ['Божественный канал (3 раза за отдых)'], 20: ['Улучшенное божественное вмешательство'] } },
  { id: 'druid', names: ['друид'], hd: 8, caster: 'full', asi: ASI, charge: { name: 'Дикий облик', reset: 'short', at: (l) => (l >= 2 && l < 20 ? 2 : l >= 20 ? 99 : undefined) },
    feat: { 1: ['Друидический язык', 'Использование заклинаний'], 2: ['Дикий облик', 'Круг друидов — выбор подкласса'], 4: ['Улучшение дикого облика'], 6: [sub('круг')], 8: ['Улучшение дикого облика'], 10: [sub('круг')], 14: [sub('круг')], 18: ['Вечная молодость', 'Заклинания зверя'], 20: ['Архидруид'] } },
  { id: 'fighter', names: ['воин', 'боец'], hd: 10, caster: undefined, asi: [4, 6, 8, 12, 14, 16, 19], charge: { name: 'Всплеск действий', reset: 'short', at: (l) => (l >= 17 ? 2 : l >= 2 ? 1 : undefined) },
    feat: { 1: ['Боевой стиль', 'Второе дыхание'], 2: ['Всплеск действий (1)'], 3: ['Воинский архетип — выбор подкласса'], 5: ['Дополнительная атака'], 7: [sub('архетип')], 9: ['Упорный (1)'], 10: [sub('архетип')], 11: ['Дополнительная атака (2)'], 13: ['Упорный (2)'], 15: [sub('архетип')], 17: ['Всплеск действий (2)', 'Упорный (3)'], 18: [sub('архетип')], 20: ['Дополнительная атака (3)'] } },
  { id: 'monk', names: ['монах'], hd: 8, caster: undefined, asi: ASI, charge: { name: 'Ци', reset: 'short', at: (l) => (l >= 2 ? l : undefined) },
    feat: { 1: ['Защита без доспехов', 'Боевые искусства'], 2: ['Ци', 'Движение без доспехов'], 3: ['Монастырская традиция — выбор подкласса', 'Отражение снарядов'], 4: ['Медленное падение'], 5: ['Дополнительная атака', 'Ошеломляющий удар'], 6: ['Энергетические удары', sub('традиция')], 7: ['Увёртливость', 'Спокойствие разума'], 9: ['Улучшенное движение без доспехов'], 10: ['Чистота тела'], 11: [sub('традиция')], 13: ['Язык солнца и луны'], 14: ['Алмазная душа'], 15: ['Безвременное тело'], 17: [sub('традиция')], 18: ['Пустое тело'], 20: ['Совершенство'] } },
  { id: 'paladin', names: ['паладин'], hd: 10, caster: 'half', asi: ASI, charge: { name: 'Божественное чувство', reset: 'long', at: () => undefined },
    feat: { 1: ['Божественное чувство', 'Наложение рук'], 2: ['Боевой стиль', 'Использование заклинаний', 'Божественная кара'], 3: ['Божественное здоровье', 'Священная клятва — выбор подкласса'], 5: ['Дополнительная атака'], 6: ['Аура защиты'], 7: [sub('клятва')], 10: ['Аура отваги'], 11: ['Улучшенная божественная кара'], 14: ['Очищающее касание'], 15: [sub('клятва')], 18: ['Улучшение аур (30 футов)'], 20: [sub('клятва')] } },
  { id: 'ranger', names: ['следопыт', 'рейнджер'], hd: 10, caster: 'half', asi: ASI,
    feat: { 1: ['Избранный враг', 'Исследователь природы'], 2: ['Боевой стиль', 'Использование заклинаний'], 3: ['Архетип следопыта — выбор подкласса', 'Первозданная осведомлённость'], 5: ['Дополнительная атака'], 6: ['Избранный враг и исследователь природы — улучшение'], 7: [sub('архетип')], 8: ['Тропой земли'], 10: ['Исследователь природы — улучшение', 'Маскировка на виду'], 11: [sub('архетип')], 14: ['Избранный враг — улучшение', 'Исчезновение'], 15: [sub('архетип')], 18: ['Дикие чувства'], 20: ['Убийца врагов'] } },
  { id: 'rogue', names: ['плут', 'вор'], hd: 8, caster: undefined, asi: [4, 8, 10, 12, 16, 19],
    feat: { 1: ['Компетентность', 'Скрытая атака (1к6)', 'Воровской жаргон'], 2: ['Хитрое действие'], 3: ['Архетип плута — выбор подкласса', 'Скрытая атака (2к6)'], 5: ['Невероятное уклонение', 'Скрытая атака (3к6)'], 6: ['Компетентность'], 7: ['Увёртливость', 'Скрытая атака (4к6)'], 9: [sub('архетип'), 'Скрытая атака (5к6)'], 11: ['Надёжный талант', 'Скрытая атака (6к6)'], 13: [sub('архетип'), 'Скрытая атака (7к6)'], 14: ['Слепое зрение'], 15: ['Скользкий ум', 'Скрытая атака (8к6)'], 17: [sub('архетип'), 'Скрытая атака (9к6)'], 18: ['Неуловимость'], 19: ['Скрытая атака (10к6)'], 20: ['Удача'] } },
  { id: 'sorcerer', names: ['чародей'], hd: 6, caster: 'full', asi: ASI, charge: { name: 'Очки чародейства', reset: 'long', at: (l) => (l >= 2 ? l : undefined) },
    feat: { 1: ['Использование заклинаний', 'Происхождение чародея — выбор подкласса'], 2: ['Источник магии (очки чародейства)'], 3: ['Метамагия (2 варианта)'], 6: [sub('происхождение')], 10: ['Метамагия (+1 вариант)'], 14: [sub('происхождение')], 17: ['Метамагия (+1 вариант)'], 18: [sub('происхождение')], 20: ['Чародейское восстановление'] } },
  { id: 'warlock', names: ['колдун'], hd: 8, caster: 'pact', asi: ASI,
    feat: { 1: ['Потусторонний покровитель — выбор подкласса', 'Магия договора'], 2: ['Таинственные воззвания (2)'], 3: ['Предмет договора'], 5: ['Таинственные воззвания (3)'], 6: [sub('покровитель')], 7: ['Таинственные воззвания (4)'], 9: ['Таинственные воззвания (5)'], 10: [sub('покровитель')], 11: ['Таинственный арканум (6 круг)'], 12: ['Таинственные воззвания (6)'], 13: ['Таинственный арканум (7 круг)'], 14: [sub('покровитель')], 15: ['Таинственный арканум (8 круг)', 'Таинственные воззвания (7)'], 17: ['Таинственный арканум (9 круг)'], 18: ['Таинственные воззвания (8)'], 20: ['Таинственный мастер'] } },
  { id: 'wizard', names: ['волшебник', 'маг'], hd: 6, caster: 'full', asi: ASI,
    feat: { 1: ['Использование заклинаний', 'Магическое восстановление'], 2: ['Магическая традиция — выбор подкласса'], 6: [sub('традиция')], 10: [sub('традиция')], 14: [sub('традиция')], 18: ['Мастерство заклинаний'], 20: ['Фирменные заклинания'] } },
];

const FULL = [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
export function slotsFor(c: Cls, l: number): number[] | undefined {
  if (c.caster === 'full') return FULL[l - 1];
  if (c.caster === 'half') return l >= 2 ? FULL[Math.ceil(l / 2) - 1] : [];
  if (c.caster === 'pact') { const n = l >= 17 ? 4 : l >= 11 ? 3 : l >= 2 ? 2 : 1; const lv = Math.min(5, Math.ceil(l / 2)); return Array.from({ length: lv }, (_, i) => (i === lv - 1 ? n : 0)); }
  return undefined;
}

const all = (s: Sheet) => s.pages.flatMap((p) => p.blocks);
export function findClass(s: Sheet): Cls | undefined {
  const v = (all(s).find((b) => b.label === 'Класс')?.value ?? '').toLowerCase().replace(/ё/g, 'е');
  return CLASSES.find((c) => c.names.some((n) => v.includes(n)));
}
export function currentLevel(s: Sheet): number { const b = all(s).find((x) => keyOf(x) === 'level'); return parseInt(b?.value ?? '', 10) || 0; }

export interface LevelPlan { cls: Cls; from: number; to: number; hpGain: number; feats: string[]; asi: boolean; slots?: number[] }
export function plan(s: Sheet, cls: Cls, hp: 'avg' | 'roll' | number): LevelPlan {
  const from = currentLevel(s); const to = Math.min(20, from + 1);
  const con = calcSheet(s).mods['ТЕЛ'] ?? 0;
  const die = typeof hp === 'number' ? hp : hp === 'avg' ? cls.hd / 2 + 1 : 1 + Math.floor(Math.random() * cls.hd);
  return { cls, from, to, hpGain: Math.max(1, die + con), feats: cls.feat[to] ?? [], asi: cls.asi.includes(to), slots: slotsFor(cls, to) };
}

export function applyLevel(s: Sheet, p: LevelPlan, writeFeats: boolean): Sheet {
  const n = (v?: string) => parseInt((v ?? '').replace('−', '-'), 10);
  const upd = (pred: (b: Block) => boolean, fn: (b: Block) => Block) => { s = { ...s, pages: s.pages.map((pg) => ({ ...pg, blocks: pg.blocks.map((b) => (pred(b) ? fn(b) : b)) })) }; };
  upd((b) => keyOf(b) === 'level', (b) => ({ ...b, value: String(p.to) }));
  const max = n(all(s).find((b) => b.label === 'Максимум хитов')?.value);
  if (!Number.isNaN(max)) {
    upd((b) => b.label === 'Максимум хитов', (b) => ({ ...b, value: String(max + p.hpGain) }));
    upd((b) => b.label === 'Текущие хиты', (b) => ({ ...b, value: String((Number.isNaN(n(b.value)) ? max : n(b.value)) + p.hpGain) }));
  }
  upd((b) => b.label === 'Кости хитов', (b) => ({ ...b, value: `${p.to}к${p.cls.hd}` }));
  if (p.slots) upd((b) => b.type === 'circles' && /ячейк/i.test(b.label), (b) => ({ ...b, rows: (b.rows ?? []).map((r, i) => ({ ...r, count: p.slots![i] ?? 0, filled: Math.min(r.filled, p.slots![i] ?? 0) })) }));
  if (writeFeats && (p.feats.length || p.asi)) {
    const line = `${p.to} ур.: ${[...p.feats, ...(p.asi ? ['Увеличение характеристик или черта'] : [])].join('; ')}`;
    upd((b) => b.label === 'Способности класса и подкласса', (b) => (b.parts?.length ? { ...b, values: [(b.values?.[0] ? b.values[0] + '\n' : '') + line, ...(b.values ?? []).slice(1)] } : { ...b, value: (b.value ? b.value + '\n' : '') + line }));
  }
  const ch = p.cls.charge; const cnt = ch?.at(p.to);
  if (ch && cnt !== undefined) {
    const list = [...(s.play?.charges ?? [])]; const i = list.findIndex((c) => c.name.toLowerCase() === ch.name.toLowerCase());
    const max2 = Math.min(cnt, 20);
    if (i >= 0) list[i] = { ...list[i]!, max: max2, used: Math.min(list[i]!.used, max2) }; else list.push({ id: uid(), name: ch.name, max: max2, used: 0, reset: ch.reset });
    s = { ...s, play: { ...s.play, charges: list } };
  }
  return s;
}
export const avgText = (hd: number, con: number) => `${hd / 2 + 1}${con ? (con > 0 ? ` + ${con}` : ` − ${-con}`) : ''}`;
export { abilityMod };

/* ---------------- мультикласс (правила 2014) ---------------- */
export const PREREQ: Record<string, { all?: string[]; any?: string[] }> = {
  barbarian: { all: ['СИЛ'] }, bard: { all: ['ХАР'] }, cleric: { all: ['МДР'] }, druid: { all: ['МДР'] }, fighter: { any: ['СИЛ', 'ЛВК'] }, monk: { all: ['ЛВК', 'МДР'] },
  paladin: { all: ['СИЛ', 'ХАР'] }, ranger: { all: ['ЛВК', 'МДР'] }, rogue: { all: ['ЛВК'] }, sorcerer: { all: ['ХАР'] }, warlock: { all: ['ХАР'] }, wizard: { all: ['ИНТ'] },
};
export const MC_PROF: Record<string, string> = {
  barbarian: 'щиты, простое и воинское оружие', bard: 'лёгкие доспехи, один навык на выбор, один музыкальный инструмент', cleric: 'лёгкие и средние доспехи, щиты',
  druid: 'лёгкие и средние доспехи, щиты (друиды не носят металлические)', fighter: 'лёгкие и средние доспехи, щиты, простое и воинское оружие', monk: 'простое оружие, короткие мечи',
  paladin: 'лёгкие и средние доспехи, щиты, простое и воинское оружие', ranger: 'лёгкие и средние доспехи, щиты, простое и воинское оружие, один навык из списка следопыта',
  rogue: 'лёгкие доспехи, один навык из списка плута, воровские инструменты', sorcerer: 'новых владений нет', warlock: 'лёгкие доспехи, простое оружие', wizard: 'новых владений нет',
};
export const CLASS_RU: Record<string, string> = { barbarian: 'Варвар', bard: 'Бард', cleric: 'Жрец', druid: 'Друид', fighter: 'Воин', monk: 'Монах', paladin: 'Паладин', ranger: 'Следопыт', rogue: 'Плут', sorcerer: 'Чародей', warlock: 'Колдун', wizard: 'Волшебник' };
const ABBR: Record<string, string> = { СИЛ: 'Сила', ЛВК: 'Ловкость', ТЕЛ: 'Телосложение', ИНТ: 'Интеллект', МДР: 'Мудрость', ХАР: 'Харизма' };

export type ClassLv = { id: string; level: number };
export function getClasses(s: Sheet): ClassLv[] {
  if (s.dnd?.classes?.length) return s.dnd.classes;
  const c = findClass(s); const l = currentLevel(s);
  return c && l ? [{ id: c.id, level: l }] : [];
}
function score(s: Sheet, ab: string): number | undefined { const b = all(s).find((x) => x.type === 'abilityx' && x.label === ABBR[ab]); const v = parseInt(b?.score ?? '', 10); return Number.isNaN(v) ? undefined : v; }
/** Проверка условий мультикласса: 13 в нужной характеристике у старого и у нового класса. */
export function prereqProblems(s: Sheet, ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const p = PREREQ[id]!; const ok = p.all ? p.all.every((a) => (score(s, a) ?? 0) >= 13) : p.any!.some((a) => (score(s, a) ?? 0) >= 13);
    if (!ok) out.push(`${CLASS_RU[id]}: нужно ${p.all ? p.all.join(' и ') : p.any!.join(' или ')} не меньше 13`);
  }
  return out;
}
export function mcSlots(classes: ClassLv[]): { slots?: number[]; pact?: string } {
  const casters = classes.filter((c) => { const k = CLASSES.find((x) => x.id === c.id)!; return k.caster === 'full' || (k.caster === 'half' && c.level >= 2); });
  const lock = classes.find((c) => c.id === 'warlock');
  const pactSlots = lock ? slotsFor(CLASSES.find((x) => x.id === 'warlock')!, lock.level) : undefined;
  const pact = lock && pactSlots ? `ячейки договора колдуна отдельно: ${pactSlots[pactSlots.length - 1]} × ${pactSlots.length} круг` : undefined;
  if (!casters.length) return lock && classes.length === 1 ? { slots: pactSlots } : { slots: classes.some((c) => CLASSES.find((x) => x.id === c.id)!.caster) ? [] : undefined, pact };
  if (casters.length === 1 && !lock) { const c = casters[0]!; return { slots: slotsFor(CLASSES.find((x) => x.id === c.id)!, c.level) }; }
  const lvl = casters.reduce((a, c) => a + (CLASSES.find((x) => x.id === c.id)!.caster === 'full' ? c.level : Math.floor(c.level / 2)), 0);
  return { slots: lvl ? FULL[Math.min(20, lvl) - 1] : [], pact };
}
export interface MCPlan { cls: Cls; classLevel: number; total: number; hpGain: number; feats: string[]; asi: boolean; slots?: number[]; pact?: string; newClass: boolean; classes: ClassLv[] }
export function planMC(s: Sheet, clsId: string, hpDie: number): MCPlan {
  const cls = CLASSES.find((c) => c.id === clsId)!; const cur = getClasses(s);
  const had = cur.find((c) => c.id === clsId); const classes = had ? cur.map((c) => (c.id === clsId ? { ...c, level: c.level + 1 } : c)) : [...cur, { id: clsId, level: 1 }];
  const classLevel = had ? had.level + 1 : 1; const total = classes.reduce((a, c) => a + c.level, 0);
  const con = calcSheet(s).mods['ТЕЛ'] ?? 0; const sl = mcSlots(classes);
  return { cls, classLevel, total, hpGain: Math.max(1, hpDie + con), feats: cls.feat[classLevel] ?? [], asi: cls.asi.includes(classLevel), slots: sl.slots, pact: sl.pact, newClass: !had && cur.length > 0, classes };
}
export function applyMC(s: Sheet, p: MCPlan, writeFeats: boolean): Sheet {
  const base: LevelPlan = { cls: p.cls, from: p.total - 1, to: p.total, hpGain: p.hpGain, feats: [], asi: false, slots: p.slots };
  let r = applyLevel(s, base, false);
  const upd = (pred: (b: Block) => boolean, fn: (b: Block) => Block) => { r = { ...r, pages: r.pages.map((pg) => ({ ...pg, blocks: pg.blocks.map((b) => (pred(b) ? fn(b) : b)) })) }; };
  // классы и кости хитов по каждому классу
  if (p.classes.length > 1) {
    upd((b) => b.label === 'Класс', (b) => ({ ...b, value: p.classes.map((c) => `${CLASS_RU[c.id]} ${c.level}`).join(' / ') }));
    const byDie = new Map<number, number>(); for (const c of p.classes) { const d = CLASSES.find((x) => x.id === c.id)!.hd; byDie.set(d, (byDie.get(d) ?? 0) + c.level); }
    upd((b) => b.label === 'Кости хитов', (b) => ({ ...b, value: [...byDie.entries()].sort((a, b2) => b2[0] - a[0]).map(([d, n]) => `${n}к${d}`).join(' + ') }));
  }
  if (writeFeats && (p.feats.length || p.asi || p.newClass)) {
    const items = [...p.feats, ...(p.asi ? ['Увеличение характеристик или черта'] : []), ...(p.newClass ? [`владения: ${MC_PROF[p.cls.id]}`] : [])];
    const line = `${CLASS_RU[p.cls.id]} ${p.classLevel} ур.: ${items.join('; ')}`;
    upd((b) => b.label === 'Способности класса и подкласса', (b) => (b.parts?.length ? { ...b, values: [(b.values?.[0] ? b.values[0] + '\n' : '') + line, ...(b.values ?? []).slice(1)] } : { ...b, value: (b.value ? b.value + '\n' : '') + line }));
  }
  const ch = p.cls.charge; const cnt = ch?.at(p.classLevel);
  if (ch && cnt !== undefined) {
    const list = [...(r.play?.charges ?? [])]; const i = list.findIndex((c) => c.name.toLowerCase() === ch.name.toLowerCase()); const m = Math.min(cnt, 20);
    if (i >= 0) list[i] = { ...list[i]!, max: m, used: Math.min(list[i]!.used, m) }; else list.push({ id: uid(), name: ch.name, max: m, used: 0, reset: ch.reset });
    r = { ...r, play: { ...r.play, charges: list } };
  }
  return { ...r, dnd: { ...r.dnd, classes: p.classes } };
}
