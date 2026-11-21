/**
 * Модель листа: страницы A4 из блоков с координатами в миллиметрах.
 * Поля по 12 мм остаются белыми — принтер не печатает края бумаги.
 */
export const PAGE_W = 210, PAGE_H = 297, MARGIN = 12;

export type Frame = 'frame' | 'line' | 'none';
export type BlockType = 'title' | 'field' | 'text' | 'image' | 'ability' | 'stat' | 'checklist' | 'circles' | 'table' | 'spells' | 'emblem' | 'ornament' | 'qr';

export interface CheckItem { name: string; sub?: string; checked?: boolean; value?: string }
export interface CircleRow { name: string; count: number; filled: number }

export interface Block {
  id: string;
  type: BlockType;
  x: number; y: number; w: number; h: number;
  label: string;
  /** кегль подписи и содержимого, pt */
  fontSize: number;
  frame: Frame;
  value?: string;
  /** характеристика: значение и модификатор (пусто — считается сам) */
  score?: string; mod?: string;
  shape?: 'box' | 'shield' | 'circle' | 'medal';
  items?: CheckItem[];
  rows?: CircleRow[];
  columns?: string[];
  cells?: string[][];
  /** блок заклинаний: какие круги показывать */
  minLevel?: number; maxLevel?: number;
  src?: string;
  lined?: boolean;
  /** смысл блока для автоподсчёта: СИЛ…ХАР, prof, init, passive, level */
  key?: string;
  /** текст в несколько колонок: заголовки колонок и их содержимое */
  parts?: string[];
  values?: string[];
  /** ширина столбцов таблицы в процентах */
  widths?: number[];
  /** закреплён: нельзя двигать и менять размер */
  fixed?: boolean;
}

export interface Page { id: string; title: string; kind: 'layout' | 'spellbook'; blocks: Block[] }

export interface SpellData {
  id: string; ed: '2014' | '2024'; src: string; name: string; ru?: string;
  lvl: number; school: string; time: string; range: string; v: number; s: number; m?: string; dur: string; c: number; r: number; cls: string[]; text: string;
  /** русский перевод: время, дистанция, длительность, материалы, описание */
  rt?: string; rr?: string; rd?: string; rm?: string; rtext?: string;
}
export interface SheetSpell { key: string; ref?: string; custom?: SpellData; prepared: boolean; note?: string }

export interface Sheet {
  id: string;
  name: string;
  updatedAt: number;
  /** общий множитель шрифта */
  fontScale: number;
  paper: 'white' | 'parchment';
  emblem?: string;
  /** набор шрифтов листа */
  fonts?: FontSet;
  /** стиль оформления листа */
  theme?: SheetTheme;
  /** версия разметки листа (для однократных обновлений старых листов) */
  ver?: number;
  pages: Page[];
  spells: SheetSpell[];
}

export const WEAPON_COLS = ['Оружие', 'Урон', 'Бонус к попаданию', 'Бонус к урону', 'Вид урона'];
export const WEAPON_W = [30, 15, 15, 15, 25];
const OLD_WEAPON = ['Оружие', 'Попадание', 'Бонус к урону', 'Урон', 'Вид урона'];
/** Старые листы: таблица оружия в прежнем порядке → новый порядок, текст переезжает вместе с колонками. */
export function migrateSheet(s: Sheet): Sheet {
  const order = WEAPON_COLS.map((c) => OLD_WEAPON.indexOf(c === 'Бонус к попаданию' ? 'Попадание' : c));
  return { ...s, pages: s.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => {
    if (b.type !== 'table' || b.columns?.join('|') !== OLD_WEAPON.join('|')) return b;
    return { ...b, columns: [...WEAPON_COLS], widths: [...WEAPON_W], cells: (b.cells ?? []).map((row) => order.map((i) => row[i] ?? '')) };
  }) })) };
}

/**
 * Разметка страницы как в свежем шаблоне, без потери вписанного:
 * блоки с той же подписью и типом встают на место из шаблона, остальные остаются, если им есть место.
 */
export function relayoutFromTemplate(page: Page, findFree: (bl: Block[], w: number, h: number) => { x: number; y: number; w: number; h: number } | undefined): { page: Page; dropped: number } | undefined {
  const tpl = clubTemplate().pages.find((p) => p.title === page.title) ?? PAGE_TEMPLATES.map((t) => t.make()).find((p) => p.title === page.title);
  if (!tpl) return undefined;
  const used = new Set<string>();
  const out: Block[] = tpl.blocks.map((t) => {
    const old = page.blocks.find((b) => !used.has(b.id) && b.type === t.type && b.label === t.label && (t.type !== 'qr' || b.src === t.src));
    if (!old) return t;
    used.add(old.id);
    return { ...old, x: t.x, y: t.y, w: t.w, h: t.h, fixed: t.fixed, ...(t.type === 'table' && old.columns?.join() === t.columns?.join() ? { widths: t.widths } : {}) };
  });
  let dropped = 0;
  for (const b of page.blocks) {
    if (used.has(b.id)) continue;
    const r = findFree(out, b.w, b.h);
    if (r) out.push({ ...b, ...r }); else dropped++;
  }
  return { page: { ...page, blocks: out }, dropped };
}

export type SheetTheme = 'club' | 'chronicle' | 'strict';
export const THEMES: { id: SheetTheme; name: string; hint: string; fonts: FontSet; ink: string; accent: string; label: string }[] = [
  { id: 'club', name: 'Клубный', hint: 'зелёный и песочный, звёзды и месяц', fonts: 'tale', ink: '#444e46', accent: '#aa9173', label: '#8a7357' },
  { id: 'chronicle', name: 'Летопись', hint: 'старинная рукопись, завитки по углам', fonts: 'chronicle', ink: '#4a3426', accent: '#b08a5a', label: '#7d2f28' },
  { id: 'strict', name: 'Строгий', hint: 'чёрно-белый, экономит краску', fonts: 'strict', ink: '#222222', accent: '#9a9a9a', label: '#4a4a4a' },
];

export type FontSet = 'tale' | 'chronicle' | 'rune' | 'strict';
export const FONT_SETS: { id: FontSet; name: string; hint: string }[] = [
  { id: 'tale', name: 'Сказание', hint: 'книжный, как в старых томах' },
  { id: 'rune', name: 'Руны', hint: 'резкие высокие буквы' },
  { id: 'chronicle', name: 'Летопись', hint: 'изящный, тонкий' },
  { id: 'strict', name: 'Строгий', hint: 'простой и чёткий' },
];

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const BLOCK_NAMES: Record<BlockType, string> = {
  title: 'Заголовок', field: 'Поле', text: 'Текст', image: 'Картинка', ability: 'Характеристика', stat: 'Число', checklist: 'Список с отметками',
  circles: 'Кружки (ячейки, спасброски)', table: 'Таблица', spells: 'Список заклинаний', emblem: 'Эмблема клуба', ornament: 'Украшение', qr: 'QR-код',
};

export function makeBlock(type: BlockType, p: Partial<Block> = {}): Block {
  const base: Block = { id: uid(), type, x: 30, y: 40, w: 60, h: 14, label: BLOCK_NAMES[type], fontSize: 9, frame: 'frame' };
  const d: Partial<Block> =
    type === 'title' ? { h: 14, frame: 'line', fontSize: 20, label: 'Заголовок', value: '' }
    : type === 'field' ? { h: 12, frame: 'line', value: '' }
    : type === 'text' ? { h: 40, value: '', lined: true }
    : type === 'image' ? { w: 50, h: 60, label: 'Портрет' }
    : type === 'ability' ? { w: 30, h: 28, score: '', mod: '' }
    : type === 'stat' ? { w: 28, h: 26, value: '', shape: 'box' }
    : type === 'checklist' ? { w: 60, h: 40, items: [{ name: 'Пункт' }, { name: 'Пункт' }] }
    : type === 'circles' ? { w: 80, h: 18, rows: [{ name: 'Ряд', count: 3, filled: 0 }] }
    : type === 'table' ? { w: 90, h: 40, columns: ['Название', 'Значение'], cells: [['', ''], ['', ''], ['', '']] }
    : type === 'spells' ? { w: 186, h: 80, minLevel: 0, maxLevel: 9, label: 'Заклинания' }
    : type === 'emblem' ? { w: 28, h: 28, frame: 'none', label: '' }
    : type === 'qr' ? { w: 22, h: 30, label: 'Наш канал', src: 'icons/qr-channel.png', fontSize: 7 }
    : { w: 120, h: 6, frame: 'none', label: '' };
  return { ...base, ...d, ...p };
}

const ABILITIES: [string, string][] = [['Сила', 'СИЛ'], ['Ловкость', 'ЛВК'], ['Телосложение', 'ТЕЛ'], ['Интеллект', 'ИНТ'], ['Мудрость', 'МДР'], ['Харизма', 'ХАР']];
const SKILLS: [string, string][] = [
  ['Акробатика', 'ЛВК'], ['Анализ', 'ИНТ'], ['Атлетика', 'СИЛ'], ['Внимательность', 'МДР'], ['Выживание', 'МДР'], ['Выступление', 'ХАР'], ['Запугивание', 'ХАР'], ['История', 'ИНТ'], ['Ловкость рук', 'ЛВК'],
  ['Магия', 'ИНТ'], ['Медицина', 'МДР'], ['Обман', 'ХАР'], ['Природа', 'ИНТ'], ['Проницательность', 'МДР'], ['Религия', 'ИНТ'], ['Скрытность', 'ЛВК'], ['Убеждение', 'ХАР'], ['Уход за животными', 'МДР'],
];

const B = makeBlock;
function bioPage(): Page {
  const f = (label: string, x: number, y: number, w: number, h = 11) => B('field', { label, x, y, w, h });
  const t = (label: string, x: number, y: number, w: number, h: number) => B('text', { label, x, y, w, h });
  return {
    id: uid(), title: 'Биография', kind: 'layout', blocks: [
      B('title', { label: 'Имя персонажа', x: 12, y: 13, w: 130, h: 16, fontSize: 22 }),
      B('stat', { label: 'Уровень', key: 'level', shape: 'medal', x: 145, y: 10, w: 21, h: 21, fontSize: 7 }),
      B('emblem', { x: 170, y: 12, w: 28, h: 28 }),
      B('image', { label: 'Портрет', x: 12, y: 32, w: 62, h: 79 }),
      f('Класс', 78, 32, 60), f('Вид', 140, 32, 30),
      f('Предыстория', 78, 45, 60), f('Мировоззрение', 140, 45, 58),
      f('Возраст', 78, 58, 28), f('Рост', 108, 58, 28), f('Вес', 140, 58, 28), f('Глаза', 170, 58, 28),
      f('Кожа', 78, 71, 38), f('Волосы', 118, 71, 38), f('Игрок', 158, 71, 40),
      f('Вера, божество', 78, 84, 60), f('Родина', 140, 84, 58),
      f('Кампания', 78, 97, 120, 13),
      t('Внешность', 12, 115, 93, 32), t('Черты характера и манеры', 107, 115, 91, 32),
      t('Предыстория персонажа', 12, 150, 186, 71),
      t('Цели', 12, 224, 93, 30), t('Задачи', 107, 224, 67, 30),
      t('Союзники и организации', 12, 257, 93, 28), t('Триггеры, страхи и слабости', 107, 257, 67, 28),
      B('qr', { label: 'Наш канал', src: 'icons/qr-channel.png', x: 176, y: 224, w: 22, h: 30 }),
      B('qr', { label: 'Наш чат', src: 'icons/qr-chat.png', x: 176, y: 257, w: 22, h: 28 }),
    ],
  };
}

function statsPage(): Page {
  const row = ['Класс доспеха', 'Инициатива', 'Скорость', 'Бонус мастерства', 'Вдохновение', 'Пасс. внимательность'];
  const bw = (186 - 5 * 2) / 6;
  const ROW_KEYS = ['ac', 'init', 'speed', 'prof', 'insp', 'passive'];
  return {
    id: uid(), title: 'Характеристики', kind: 'layout', blocks: [
      B('title', { label: 'Характеристики', x: 12, y: 12, w: 150, h: 13, fontSize: 18 }),
      B('emblem', { x: 182, y: 11, w: 16, h: 16 }),
      ...row.map((label, i) => B('stat', { label, key: ROW_KEYS[i], x: 12 + i * (bw + 2), y: 28, w: bw, h: 17, shape: i === 0 ? 'shield' : 'box', fontSize: 7 })),
      ...ABILITIES.map(([label, key], i) => B('ability', { label, key, x: 12, y: 47 + i * 28, w: 30, h: 26 })),
      B('checklist', { label: 'Спасброски', x: 44, y: 47, w: 60, h: 50, items: ABILITIES.map(([n, s]) => ({ name: n, sub: s })) }),
      B('checklist', { label: 'Навыки', x: 44, y: 99, w: 60, h: 114, items: SKILLS.map(([n, s]) => ({ name: n, sub: s })) }),
      B('stat', { label: 'Максимум хитов', x: 106, y: 47, w: 30, h: 16, fontSize: 6.5 }),
      B('field', { label: 'Текущие хиты', x: 138, y: 47, w: 60, h: 16, frame: 'frame', fontSize: 11 }),
      B('field', { label: 'Временные хиты', x: 106, y: 65, w: 45, h: 13, frame: 'frame' }),
      B('field', { label: 'Кости хитов', x: 153, y: 65, w: 45, h: 13, frame: 'frame' }),
      B('circles', { label: 'Спасброски от смерти', x: 106, y: 80, w: 92, h: 16, rows: [{ name: 'Успехи', count: 3, filled: 0 }, { name: 'Провалы', count: 3, filled: 0 }] }),
      B('table', { label: 'Оружие', x: 106, y: 98, w: 92, h: 50, fontSize: 8, columns: WEAPON_COLS, widths: WEAPON_W, cells: Array.from({ length: 5 }, () => ['', '', '', '', '']) }),
      B('text', { label: 'Владения и языки', x: 106, y: 150, w: 92, h: 63 }),
      B('text', { label: 'Снаряжение', x: 12, y: 216, w: 124, h: 69 }),
      B('table', { label: 'Монеты', x: 138, y: 216, w: 60, h: 17, fontSize: 8, columns: ['ПМ', 'ЗМ', 'ЭМ', 'СМ', 'ММ'], cells: [['', '', '', '', '']] }),
      B('text', { label: 'Сокровища', x: 138, y: 235, w: 60, h: 50 }),
    ],
  };
}

function featuresPage(): Page {
  const two = (label: string, parts: string[], y: number, h: number) => B('text', { label, x: 12, y, w: 186, h, parts, values: parts.map(() => '') });
  return {
    id: uid(), title: 'Способности', kind: 'layout', blocks: [
      B('title', { label: 'Способности', x: 12, y: 12, w: 150, h: 13, fontSize: 18 }),
      B('emblem', { x: 182, y: 11, w: 16, h: 16 }),
      two('Способности класса и подкласса', ['Класс', 'Подкласс'], 28, 84),
      two('Способности вида и предыстории', ['Вид', 'Предыстория'], 115, 56),
      two('Черты и дополнительные способности', ['Черты', 'Дополнительно'], 174, 111),
    ],
  };
}

function magicPage(): Page {
  return {
    id: uid(), title: 'Магия', kind: 'layout', blocks: [
      B('title', { label: 'Магия', x: 12, y: 12, w: 150, h: 13, fontSize: 18 }),
      B('emblem', { x: 182, y: 11, w: 16, h: 16 }),
      B('field', { label: 'Заклинательный класс', x: 12, y: 28, w: 60, h: 13 }),
      B('field', { label: 'Характеристика', x: 74, y: 28, w: 40, h: 13 }),
      B('field', { label: 'СЛ спасброска', x: 116, y: 28, w: 40, h: 13 }),
      B('field', { label: 'Бонус атаки', x: 158, y: 28, w: 40, h: 13 }),
      B('circles', { label: 'Ячейки заклинаний', x: 12, y: 44, w: 186, h: 20, rows: [4, 3, 3, 3, 3, 2, 2, 1, 1].map((count, i) => ({ name: `${i + 1} круг`, count, filled: 0 })) }),
      B('spells', { label: 'Заговоры', x: 12, y: 67, w: 186, h: 50, minLevel: 0, maxLevel: 0 }),
      B('spells', { label: 'Заклинания', x: 12, y: 120, w: 186, h: 165, minLevel: 1, maxLevel: 9 }),
    ],
  };
}

/** Закреплённые блоки шаблона: страница → подписи (пустая подпись — эмблема). */
export const FIXED: Record<string, (b: Block) => boolean> = {
  'Биография': (b) => b.type === 'emblem' || b.type === 'qr' || (b.y < 112 && ['title', 'stat', 'image', 'field'].includes(b.type)),
  'Характеристики': (b) => !['Снаряжение', 'Монеты', 'Сокровища'].includes(b.label),
};
export const markFixed = (p: Page): Page => (FIXED[p.title] ? { ...p, blocks: p.blocks.map((b) => (FIXED[p.title]!(b) ? { ...b, fixed: true } : b)) } : p);

export function clubTemplate(): Sheet {
  return {
    id: uid(), name: 'Новый персонаж', updatedAt: Date.now(), fontScale: 1, paper: 'white',
    ver: 2, pages: [markFixed(bioPage()), markFixed(statsPage()), featuresPage(), magicPage(), { id: uid(), title: 'Книга заклинаний', kind: 'spellbook', blocks: [] }],
    spells: [],
  };
}
export function blankPage(title = 'Новый лист'): Page {
  return { id: uid(), title, kind: 'layout', blocks: [B('title', { label: title, x: 12, y: 12, w: 150, h: 13, fontSize: 18 }), B('emblem', { x: 182, y: 11, w: 16, h: 16 })] };
}
export const PAGE_TEMPLATES: { name: string; make: () => Page }[] = [
  { name: 'Пустой лист', make: () => blankPage() },
  { name: 'Биография', make: () => markFixed(bioPage()) },
  { name: 'Характеристики', make: () => markFixed(statsPage()) },
  { name: 'Способности', make: featuresPage },
  { name: 'Магия', make: magicPage },
  { name: 'Заметки', make: () => ({ ...blankPage('Заметки'), blocks: [...blankPage('Заметки').blocks, B('text', { label: 'Заметки', x: 12, y: 28, w: 186, h: 257 })] }) },
  { name: 'Книга заклинаний', make: () => ({ id: uid(), title: 'Книга заклинаний', kind: 'spellbook', blocks: [] }) },
];

export const signed = (m: number) => (m >= 0 ? `+${m}` : `−${Math.abs(m)}`);
export const abilityMod = (score: string) => {
  const n = parseInt(score, 10);
  if (Number.isNaN(n)) return '';
  return signed(Math.floor((n - 10) / 2));
};
/** «+3», «−1», «3» → число; пусто или мусор → undefined */
export const parseMod = (v?: string) => {
  if (!v) return undefined;
  const n = parseInt(v.replace('−', '-').replace(/\s/g, ''), 10);
  return Number.isNaN(n) ? undefined : n;
};

const LABEL_KEYS: Record<string, string> = Object.fromEntries([
  ...ABILITIES.map(([l, k]) => [l, k]), ['Бонус мастерства', 'prof'], ['Инициатива', 'init'], ['Пасс. внимательность', 'passive'], ['Пассивная внимательность', 'passive'], ['Уровень', 'level'],
]);
/** Смысл блока: из поля key или по подписи (для листов, созданных до автоподсчёта). */
export const keyOf = (b: Block) => b.key ?? LABEL_KEYS[b.label];

export interface Calc { mods: Record<string, number | undefined>; prof?: number; perception?: number }
/** Что лист может посчитать сам: модификаторы характеристик и бонус мастерства. */
export function calcSheet(sheet: Sheet): Calc {
  const all = sheet.pages.flatMap((p) => p.blocks);
  const mods: Calc['mods'] = {};
  for (const b of all) if (b.type === 'ability') { const k = keyOf(b); if (k) mods[k] = parseMod(b.mod || abilityMod(b.score ?? '')); }
  const level = parseInt(all.find((b) => keyOf(b) === 'level')?.value ?? '', 10);
  const profBlock = all.find((b) => keyOf(b) === 'prof');
  const prof = parseMod(profBlock?.value) ?? (level >= 1 ? 2 + Math.floor((Math.min(level, 20) - 1) / 4) : undefined);
  const perc = all.find((b) => b.type === 'checklist' && b.items?.some((i) => i.name === 'Внимательность'))?.items?.find((i) => i.name === 'Внимательность');
  const perception = perc ? parseMod(perc.value) ?? autoItem(perc, mods, prof) : undefined;
  return { mods, prof, perception };
}
const CODE: Record<string, string> = { СИЛ: 'СИЛ', ЛВК: 'ЛВК', ТЕЛ: 'ТЕЛ', ИНТ: 'ИНТ', МДР: 'МДР', ХАР: 'ХАР' };
/** Навык или спасбросок: модификатор характеристики + бонус мастерства, если отмечено владение. */
export function autoItem(it: CheckItem, mods: Calc['mods'], prof?: number): number | undefined {
  const m = it.sub ? mods[CODE[it.sub] ?? ''] : undefined;
  if (m === undefined) return undefined;
  return m + (it.checked && prof ? prof : 0);
}
/** Автозначение для числа (инициатива, пассивная внимательность, бонус мастерства). */
export function autoStat(b: Block, c: Calc): string {
  const k = keyOf(b);
  if (k === 'init' && c.mods['ЛВК'] !== undefined) return signed(c.mods['ЛВК']!);
  if (k === 'passive' && c.perception !== undefined) return String(10 + c.perception);
  if (k === 'prof' && c.prof !== undefined) return signed(c.prof);
  return '';
}

export const SCHOOLS: Record<string, string> = { abjuration: 'Ограждение', conjuration: 'Вызов', divination: 'Прорицание', enchantment: 'Очарование', evocation: 'Воплощение', illusion: 'Иллюзия', necromancy: 'Некромантия', transmutation: 'Преобразование' };
export const spellOf = (s: SheetSpell, db: Map<string, SpellData>): SpellData | undefined => s.custom ?? (s.ref ? db.get(s.ref) : undefined);
