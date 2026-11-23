/**
 * Модель листа: страницы A4 из блоков с координатами в миллиметрах.
 * Поля по 12 мм остаются белыми — принтер не печатает края бумаги.
 */
export const PAGE_W = 210, PAGE_H = 297, MARGIN = 12;

export type Frame = 'frame' | 'line' | 'none';
export type BlockType = 'title' | 'field' | 'text' | 'image' | 'ability' | 'stat' | 'checklist' | 'circles' | 'table' | 'spells' | 'emblem' | 'ornament' | 'qr' | 'abilityx' | 'pctstat' | 'pctlist' | 'sumlist' | 'track';

export interface CheckItem { name: string; sub?: string; checked?: boolean; value?: string }
export interface CircleRow { name: string; count: number; filled: number }

export interface Block {
  id: string;
  /** шкала чисел: до какого числа (ПЗ 20, рассудок 99) */
  count?: number;
  /** картинка-украшение из папки art */
  art?: string;
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
  /** сколько рядов кружков в строке (для блока «Кружки»); по умолчанию считается по ширине */
  perRow?: number;
  /** закреплён: нельзя двигать и менять размер */
  fixed?: boolean;
  /** размер текста внутри блока (кнопки ± на странице); подпись блока остаётся по fontSize */
  textSize?: number;
  /** спасбросок в карточке характеристики */
  save?: CheckItem;
}

export interface Page { id: string; title: string; kind: 'layout' | 'spellbook'; blocks: Block[] }

export interface SpellData {
  id: string; ed: '2014' | '2024'; src: string; name: string; ru?: string;
  lvl: number; school: string; time: string; range: string; v: number; s: number; m?: string; dur: string; c: number; r: number; cls: string[]; text: string;
  /** русский перевод: время, дистанция, длительность, материалы, описание */
  rt?: string; rr?: string; rd?: string; rm?: string; rtext?: string;
}
export interface Charge { id: string; name: string; max: number; used: number; reset: 'short' | 'long' }
export interface PlayState { charges?: Charge[]; conditions?: string[]; cur?: Record<string, number> }
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
  /** игра: D&D 5e (по умолчанию), Зов Ктулху, Клинки во тьме, Киберпанк RED */
  system?: GameSystem;
  /** «Былина»: старинные подписи (по умолчанию включены) */
  oldLabels?: boolean;
  /** игровой режим: заряды способностей, состояния, текущие значения, которых нет на листе */
  play?: PlayState;
  /** версия разметки листа (для однократных обновлений старых листов) */
  ver?: number;
  pages: Page[];
  spells: SheetSpell[];
}

export const WEAPON_COLS = ['Оружие', 'Урон', 'Бонус к попаданию', 'Бонус к урону', 'Вид урона'];
export const WEAPON_W = [30, 15, 15, 15, 25];
const HP_FIELDS = ['Текущие хиты', 'Временные хиты', 'Кости хитов'];
const OLD_WEAPON = ['Оружие', 'Попадание', 'Бонус к урону', 'Урон', 'Вид урона'];
/** Старые листы: таблица оружия в прежнем порядке → новый порядок, текст переезжает вместе с колонками. */
export function migrateSheet(s: Sheet): Sheet {
  const order = WEAPON_COLS.map((c) => OLD_WEAPON.indexOf(c === 'Бонус к попаданию' ? 'Попадание' : c));
  return { ...s, pages: s.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => {
    // хиты в одном виде с «Максимумом хитов»: крупная цифра по центру
    if (b.type === 'field' && HP_FIELDS.includes(b.label)) return { ...b, type: 'stat' as const, fontSize: 6.5 };
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
    if (t.type === 'abilityx') {
      const ab = page.blocks.find((b) => !used.has(b.id) && (b.type === 'ability' || b.type === 'abilityx') && keyOf(b) === t.key);
      if (ab) used.add(ab.id);
      const legacyItems = page.blocks.filter((b) => b.type === 'checklist').flatMap((b) => b.items ?? []);
      const fromOld = (it: CheckItem) => (ab?.type === 'abilityx' ? ab.items : legacyItems)?.find((o) => o.name === it.name);
      const oldSave = ab?.type === 'abilityx' ? ab.save : legacyItems.find((o) => o.sub === t.key && ABILITIES.some(([n]) => n === o.name));
      return { ...t, id: ab?.id ?? t.id, score: ab?.score, mod: ab?.mod, save: { ...t.save!, checked: oldSave?.checked, value: oldSave?.value },
        items: t.items!.map((it) => { const o = fromOld(it); return { ...it, checked: o?.checked, value: o?.value }; }) };
    }
    const old = page.blocks.find((b) => !used.has(b.id) && b.type === t.type && b.label === t.label && (t.type !== 'qr' || b.src === t.src));
    if (!old) return t;
    used.add(old.id);
    return { ...old, x: t.x, y: t.y, w: t.w, h: t.h, fixed: t.fixed, ...(t.type === 'table' && old.columns?.join() === t.columns?.join() ? { widths: t.widths } : {}) };
  });
  let dropped = 0;
  for (const b of page.blocks) {
    if (used.has(b.id)) continue;
    // старые характеристики и списки навыков/спасбросков уже перенесены в карточки
    if (tpl.blocks.some((t) => t.type === 'abilityx') && (b.type === 'ability' || (b.type === 'checklist' && ['Навыки', 'Спасброски'].includes(b.label)))) continue;
    const r = findFree(out, b.w, b.h);
    if (r) out.push({ ...b, ...r }); else dropped++;
  }
  return { page: { ...page, blocks: out }, dropped };
}

export type GameSystem = 'dnd' | 'coc' | 'bitd' | 'cpr';

export type SheetTheme = 'club' | 'chronicle' | 'strict' | 'eldritch' | 'noir' | 'cyber' | 'fae' | 'dark' | 'slavic';
export const THEMES: { id: SheetTheme; name: string; hint: string; fonts: FontSet; ink: string; accent: string; label: string }[] = [
  { id: 'club', name: 'Клубный', hint: 'зелёный и песочный, звёзды и месяц', fonts: 'tale', ink: '#444e46', accent: '#aa9173', label: '#8a7357' },
  { id: 'chronicle', name: 'Летопись', hint: 'старинная рукопись, завитки по углам', fonts: 'chronicle', ink: '#4a3426', accent: '#b08a5a', label: '#7d2f28' },
  { id: 'strict', name: 'Строгий', hint: 'чёрно-белый, экономит краску', fonts: 'strict', ink: '#222222', accent: '#9a9a9a', label: '#4a4a4a' },
  { id: 'eldritch', name: 'Досье', hint: 'папка сыщика 20-х, ар-деко, машинка', fonts: 'typewriter', ink: '#2f2b24', accent: '#7d8a63', label: '#35574f' },
  { id: 'noir', name: 'Газовый свет', hint: 'тёмный город, латунь, заклёпки', fonts: 'gaslight', ink: '#1e2326', accent: '#9a7b4f', label: '#7b2121' },
  { id: 'fae', name: 'Волшебный сад', hint: 'феи, цветы и звёздочки, пастель', fonts: 'fae', ink: '#5b4a73', accent: '#e58fb6', label: '#8a63c2' },
  { id: 'dark', name: 'Кровь и сталь', hint: 'кованое железо, кровь, вороны', fonts: 'dark', ink: '#1c1818', accent: '#857b72', label: '#7d1014' },
  { id: 'slavic', name: 'Былина', hint: 'вышивка, буквицы, старинные подписи', fonts: 'slavic', ink: '#2a1c16', accent: '#c0392b', label: '#b3261e' },
  { id: 'cyber', name: 'Неон', hint: 'срезанные углы, красный и бирюза', fonts: 'neon', ink: '#17171f', accent: '#13a3b5', label: '#d01f3c' },
];

/** Старинные подписи для стиля «Былина». */
export const OLD_LABELS: Record<string, string> = {
  'Имя персонажа': 'Имя богатыря', 'Класс': 'Стезя', 'Подкласс': 'Путь', 'Вид': 'Род-племя', 'Уровень': 'Ступень', 'Предыстория': 'Былое', 'Игрок': 'Сказитель',
  'Мировоззрение': 'Правда', 'Родина': 'Отчина', 'Вера, божество': 'Вера', 'Внешность': 'Облик', 'Черты характера и манеры': 'Нрав и повадки',
  'Предыстория персонажа': 'Сказ о герое', 'Союзники и организации': 'Други и братчины', 'Цели': 'Чаяния', 'Задачи': 'Заботы', 'Триггеры, страхи и слабости': 'Страхи и слабины',
  'Портрет': 'Парсуна', 'Сила': 'Сила', 'Ловкость': 'Проворство', 'Телосложение': 'Крепость', 'Интеллект': 'Разум', 'Мудрость': 'Мудрость', 'Харизма': 'Обаяние',
  'Максимум хитов': 'Здравие, предел', 'Текущие хиты': 'Здравие', 'Временные хиты': 'Здравие временное', 'Кости хитов': 'Кости здравия', 'Спасброски от смерти': 'На краю гибели',
  'Успехи': 'Удачи', 'Провалы': 'Неудачи', 'Класс доспеха': 'Броня', 'Инициатива': 'Почин', 'Скорость': 'Ход', 'Бонус мастерства': 'Умелость', 'Вдохновение': 'Воодушевление',
  'Снаряжение': 'Скарб', 'Владения': 'Навыки и владения', 'Языки': 'Наречия', 'Оружие': 'Оружие', 'Монеты': 'Казна: гривны и куны', 'Сокровища': 'Сокровища', 'Заметки': 'Записи',
  'Способности': 'Умения', 'Способности класса и подкласса': 'Умения стези', 'Способности вида и предыстории': 'Умения рода и былого', 'Черты и дополнительные способности': 'Дары и иные умения',
  'Магия': 'Чародейство', 'Заклинания': 'Заговоры и чары', 'Заговоры': 'Присловья', 'Ячейки заклинаний': 'Чародейские ячейки', 'Заклинательный класс': 'Источник чар',
  'СЛ спасброска': 'СЛ спасброска', 'Бонус атаки': 'Бонус атаки', 'Биография': 'Летопись героя', 'Характеристики': 'Стати', 'Книга заклинаний': 'Чародейная книга',
};
export const oldLabelsOn = (s: { theme?: SheetTheme; system?: GameSystem; oldLabels?: boolean }) => sheetTheme(s) === 'slavic' && s.oldLabels !== false;
export const oldLabel = (s: { theme?: SheetTheme; system?: GameSystem; oldLabels?: boolean }, l: string) => (oldLabelsOn(s) ? OLD_LABELS[l] ?? l : l);

/** стиль листа по умолчанию для каждой игры */
export const SYSTEM_THEME: Record<GameSystem, SheetTheme> = { dnd: 'club', coc: 'eldritch', bitd: 'noir', cpr: 'cyber' };
export const sheetSystem = (s: { system?: GameSystem }): GameSystem => s.system ?? 'dnd';
export const sheetTheme = (s: { theme?: SheetTheme; system?: GameSystem }): SheetTheme => s.theme ?? SYSTEM_THEME[s.system ?? 'dnd'];
export const sheetFonts = (s: { theme?: SheetTheme; system?: GameSystem; fonts?: FontSet }): FontSet => s.fonts ?? THEMES.find((t) => t.id === sheetTheme(s))!.fonts;

export type FontSet = 'tale' | 'chronicle' | 'rune' | 'strict' | 'typewriter' | 'gaslight' | 'neon' | 'fae' | 'dark' | 'slavic';
export const FONT_SETS: { id: FontSet; name: string; hint: string }[] = [
  { id: 'tale', name: 'Сказание', hint: 'книжный, как в старых томах' },
  { id: 'rune', name: 'Руны', hint: 'резкие высокие буквы' },
  { id: 'chronicle', name: 'Летопись', hint: 'изящный, тонкий' },
  { id: 'strict', name: 'Строгий', hint: 'простой и чёткий' },
  { id: 'typewriter', name: 'Машинка', hint: 'ар-деко и печатная машинка' },
  { id: 'gaslight', name: 'Газовый свет', hint: 'викторианский, с засечками' },
  { id: 'neon', name: 'Неон', hint: 'рубленый, технический' },
  { id: 'fae', name: 'Сказочный', hint: 'рукописный и мягкий' },
  { id: 'dark', name: 'Суровый', hint: 'тяжёлый, с засечками' },
  { id: 'slavic', name: 'Вязь', hint: 'старорусский, полуустав' },
];

/** Имя для списка и шапки: своё название листа, а если оно не задано — имя героя с первой страницы. */
export function sheetName(s: Sheet): string {
  if (s.name && s.name !== 'Новый персонаж') return s.name;
  const hero = s.pages[0]?.blocks.find((b) => b.type === 'title' && b.value?.trim())?.value?.trim();
  return hero || s.name || 'Новый персонаж';
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const BLOCK_NAMES: Record<BlockType, string> = {
  title: 'Заголовок', field: 'Поле', text: 'Текст', image: 'Картинка', ability: 'Характеристика', stat: 'Число', checklist: 'Список с отметками',
  circles: 'Кружки (ячейки, спасброски)', table: 'Таблица', spells: 'Список заклинаний', emblem: 'Эмблема клуба', ornament: 'Украшение', qr: 'QR-код', abilityx: 'Характеристика с навыками', pctstat: 'Характеристика в %', pctlist: 'Навыки в %', sumlist: 'Навыки: характеристика + уровень', track: 'Шкала чисел (ПЗ, рассудок)',
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
    : type === 'pctstat' ? { w: 40, h: 22, label: 'Характеристика' }
    : type === 'pctlist' ? { w: 60, h: 80, label: 'Навыки', items: [{ name: 'Навык' }] }
    : type === 'sumlist' ? { w: 60, h: 80, label: 'Навыки', items: [{ name: 'Навык', sub: 'ИНТ' }] }
    : type === 'abilityx' ? { w: 60, h: 40, label: 'Сила', key: 'СИЛ', items: [], save: { name: 'Спасбросок', sub: 'СИЛ' } }
    : type === 'track' ? { w: 90, h: 22, label: 'Шкала', count: 20, value: '' }
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

/** Карточки характеристик: ключ, x, y, высота (мм). Слева СИЛ/ЛВК/ТЕЛ, в центре ИНТ/МДР/ХАР. */
const ABX_LAYOUT: [string, number, number, number][] = [
  ['СИЛ', 12, 47, 34], ['ЛВК', 12, 83, 44], ['ТЕЛ', 12, 129, 28],
  ['ИНТ', 50, 47, 56], ['МДР', 50, 105, 56], ['ХАР', 50, 163, 50],
];

function statsPage(): Page {
  const row = ['Класс доспеха', 'Инициатива', 'Скорость', 'Бонус мастерства', 'Вдохновение', 'Пасс. внимательность'];
  const bw = (186 - 5 * 2) / 6;
  const ROW_KEYS = ['ac', 'init', 'speed', 'prof', 'insp', 'passive'];
  return {
    id: uid(), title: 'Характеристики', kind: 'layout', blocks: [
      B('title', { label: 'Характеристики', x: 12, y: 12, w: 150, h: 13, fontSize: 18 }),
      B('emblem', { x: 182, y: 11, w: 16, h: 16 }),
      ...row.map((label, i) => B('stat', { label, key: ROW_KEYS[i], x: 12 + i * (bw + 2), y: 28, w: bw, h: 17, shape: i === 0 ? 'shield' : 'box', fontSize: 7 })),
      ...ABX_LAYOUT.map(([key, x, y, h]) => {
        const label = ABILITIES.find(([, k]) => k === key)![0];
        return B('abilityx', { label, key, x, y, w: 36, h, fontSize: 7.5, save: { name: 'Спасбросок', sub: key }, items: SKILLS.filter(([, sk]) => sk === key).map(([n, sk]) => ({ name: n, sub: sk })) });
      }),
      B('stat', { label: 'Максимум хитов', x: 88, y: 47, w: 26, h: 16, fontSize: 6.5 }),
      B('stat', { label: 'Текущие хиты', x: 116, y: 47, w: 25, h: 16, fontSize: 6.5 }),
      B('stat', { label: 'Временные хиты', x: 143, y: 47, w: 25, h: 16, fontSize: 6.5 }),
      B('stat', { label: 'Кости хитов', x: 170, y: 47, w: 28, h: 16, fontSize: 6.5 }),
      B('circles', { label: 'Спасброски от смерти', x: 88, y: 65, w: 110, h: 11, rows: [{ name: 'Успехи', count: 3, filled: 0 }, { name: 'Провалы', count: 3, filled: 0 }] }),
      B('text', { label: 'Снаряжение', x: 88, y: 78, w: 54, h: 135 }),
      B('text', { label: 'Владения', x: 144, y: 78, w: 54, h: 135 }),
      B('text', { label: 'Языки', x: 12, y: 159, w: 36, h: 54 }),
      B('table', { label: 'Оружие', x: 12, y: 216, w: 124, h: 36, fontSize: 8, columns: WEAPON_COLS, widths: WEAPON_W, cells: Array.from({ length: 4 }, () => ['', '', '', '', '']) }),
      B('text', { label: 'Заметки', x: 12, y: 254, w: 124, h: 31 }),
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
      two('Способности класса и подкласса', ['Класс', 'Подкласс'], 28, 125),
      two('Способности вида и предыстории', ['Вид', 'Предыстория'], 156, 65),
      two('Черты и дополнительные способности', ['Черты', 'Дополнительно'], 224, 61),
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
  'Характеристики': (b) => !['Снаряжение', 'Монеты', 'Сокровища', 'Заметки'].includes(b.label),
};
export const markFixed = (p: Page): Page => (FIXED[p.title] ? { ...p, blocks: p.blocks.map((b) => (FIXED[p.title]!(b) ? { ...b, fixed: true } : b)) } : p);

export function clubTemplate(): Sheet {
  return {
    id: uid(), name: 'Новый персонаж', updatedAt: Date.now(), fontScale: 1, paper: 'white',
    ver: 2, system: 'dnd', pages: [markFixed(bioPage()), markFixed(statsPage()), featuresPage(), magicPage(), { id: uid(), title: 'Книга заклинаний', kind: 'spellbook', blocks: [] }, notesPage()],
    spells: [],
  };
}
/** Заметки: один лист, четыре больших блока. */
export function notesPage(): Page {
  const p = blankPage('Заметки');
  return { ...p, blocks: [...p.blocks,
    B('text', { label: 'Заметки', x: 12, y: 28, w: 92, h: 127 }), B('text', { label: 'Заметки', x: 106, y: 28, w: 92, h: 127 }),
    B('text', { label: 'Заметки', x: 12, y: 158, w: 92, h: 127 }), B('text', { label: 'Заметки', x: 106, y: 158, w: 92, h: 127 }),
  ] };
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
  { name: 'Заметки', make: notesPage },
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

export interface Calc { mods: Record<string, number | undefined>; prof?: number; perception?: number; vals: Record<string, number | undefined> }
/** Что лист может посчитать сам: модификаторы характеристик и бонус мастерства. */
export function calcSheet(sheet: Sheet): Calc {
  const all = sheet.pages.flatMap((p) => p.blocks);
  const mods: Calc['mods'] = {};
  const vals: Calc['vals'] = {};
  for (const b of all) if ((b.type === 'stat' || b.type === 'pctstat' || b.type === 'field') && b.key) { const n = parseInt(b.value ?? '', 10); vals[b.key] = Number.isNaN(n) ? undefined : n; }
  for (const b of all) if (b.type === 'ability' || b.type === 'abilityx') { const k = keyOf(b); if (k) mods[k] = parseMod(b.mod || abilityMod(b.score ?? '')); }
  const level = parseInt(all.find((b) => keyOf(b) === 'level')?.value ?? '', 10);
  const profBlock = all.find((b) => keyOf(b) === 'prof');
  const prof = parseMod(profBlock?.value) ?? (level >= 1 ? 2 + Math.floor((Math.min(level, 20) - 1) / 4) : undefined);
  const perc = all.find((b) => (b.type === 'checklist' || b.type === 'abilityx') && b.items?.some((i) => i.name === 'Внимательность'))?.items?.find((i) => i.name === 'Внимательность');
  const perception = perc ? parseMod(perc.value) ?? autoItem(perc, mods, prof) : undefined;
  // Зов Ктулху: сколько очков вложено в навыки сверх базы и значение «Мифов Ктулху»
  let spent = 0, any = false;
  for (const b of all) if (b.type === 'pctlist') for (const it of b.items ?? []) {
    if (!it.sub || it.sub === '#') continue;
    const v = parseInt(it.value ?? '', 10); if (Number.isNaN(v)) continue;
    any = true; spent += Math.max(0, v - (cocBase(it.sub, vals) ?? 0));
    if (it.name.startsWith('Мифы Ктулху')) vals['coc:mythos'] = v;
  }
  if (any) vals['coc:spent'] = spent;
  return { mods, prof, perception, vals };
}
/** База навыка Зова Ктулху: число («25») или формула («ЛВК/2», «ОБР»). */
export function cocBase(sub: string | undefined, vals: Record<string, number | undefined>): number | undefined {
  if (!sub || sub === '#') return undefined;
  if (/^\d+$/.test(sub)) return parseInt(sub, 10);
  if (sub === 'ЛВК/2') return vals['coc:DEX'] !== undefined ? Math.floor(vals['coc:DEX']! / 2) : undefined;
  if (sub === 'ОБР') return vals['coc:EDU'];
  return undefined;
}
export const cocBaseText = (sub?: string) => (!sub || sub === '#' ? '' : /^\d+$/.test(sub) ? sub.padStart(2, '0') + '%' : sub === 'ЛВК/2' ? '½ ЛВК' : sub);
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
  const v = (x: string) => c.vals[x];
  const has = (...xs: string[]) => xs.every((x) => v(x) !== undefined);
  // Зов Ктулху
  if (k === 'coc:hp' && has('coc:CON', 'coc:SIZ')) return String(Math.floor((v('coc:CON')! + v('coc:SIZ')!) / 10));
  if ((k === 'coc:db' || k === 'coc:build') && has('coc:STR', 'coc:SIZ')) {
    const t = v('coc:STR')! + v('coc:SIZ')!;
    const row = t <= 64 ? ['−2', '−2'] : t <= 84 ? ['−1', '−1'] : t <= 124 ? ['0', '0'] : t <= 164 ? ['+1d4', '+1'] : t <= 204 ? ['+1d6', '+2'] : (() => { const n = Math.floor((t - 205) / 80) + 2; return [`+${n}d6`, `+${n + 1}`]; })();
    return k === 'coc:db' ? row[0]! : row[1]!;
  }
  if (k === 'coc:mov' && has('coc:STR', 'coc:DEX', 'coc:SIZ')) {
    const [st, dx, sz] = [v('coc:STR')!, v('coc:DEX')!, v('coc:SIZ')!];
    let m = st < sz && dx < sz ? 7 : st > sz && dx > sz ? 9 : 8;
    const age = v('coc:age');
    if (age !== undefined && age >= 40) m -= Math.min(5, Math.floor((age - 30) / 10));
    return String(m);
  }
  if (k === 'coc:sanmax') return String(99 - (v('coc:mythos') ?? 0));
  if (k === 'coc:pts' && has('coc:EDU', 'coc:INT')) return String(v('coc:EDU')! * 4 + v('coc:INT')! * 2);
  if (k === 'coc:spent' && v('coc:spent') !== undefined) return String(v('coc:spent'));
  if (k === 'coc:mp' && has('coc:POW')) return String(Math.floor(v('coc:POW')! / 5));
  if (k === 'coc:san' && has('coc:POW')) return String(v('coc:POW'));
  // Киберпанк RED
  const cprHp = has('cpr:BODY', 'cpr:WILL') ? 10 + 5 * Math.ceil((v('cpr:BODY')! + v('cpr:WILL')!) / 2) : undefined;
  if (k === 'cpr:hp' && cprHp !== undefined) return String(cprHp);
  if (k === 'cpr:sw' && cprHp !== undefined) return String(Math.ceil(cprHp / 2));
  if (k === 'cpr:ds' && has('cpr:BODY')) return String(v('cpr:BODY'));
  if (k === 'cpr:hum' && has('cpr:EMP')) return String(v('cpr:EMP')! * 10);
  return '';
}

export const SCHOOLS: Record<string, string> = { abjuration: 'Ограждение', conjuration: 'Вызов', divination: 'Прорицание', enchantment: 'Очарование', evocation: 'Воплощение', illusion: 'Иллюзия', necromancy: 'Некромантия', transmutation: 'Преобразование' };
export const spellOf = (s: SheetSpell, db: Map<string, SpellData>): SpellData | undefined => s.custom ?? (s.ref ? db.get(s.ref) : undefined);
