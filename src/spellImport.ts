// Разбор списка заклинаний, вставленного текстом (или JSON), в записи базы.
import { SCHOOLS, type SpellData } from './model';

export const SPELL_TEMPLATE = `Название: Искристая пыль
Оригинал: Glitter Dust
Круг: 1
Школа: Воплощение
Время: 1 действие
Дистанция: 30 футов
Компоненты: В, С, М (щепотка толчёного стекла)
Длительность: Концентрация, до 1 минуты
Цель: точка в пределах дистанции
Площадь: куб 10 футов
Атака/спасбросок: спасбросок Ловкости
Классы: Бард, Волшебник
Источник: Домашнее правило клуба
Описание: Облако блестящей пыли окутывает куб. Каждое существо в нём совершает спасбросок Ловкости. При провале оно ослеплено до конца своего следующего хода.
Описание можно писать в несколько строк и абзацев.
---
Название: Следующее заклинание
Круг: заговор
…`;

type Key = 'name' | 'orig' | 'lvl' | 'school' | 'time' | 'range' | 'comps' | 'dur' | 'target' | 'area' | 'effect' | 'cls' | 'src' | 'text' | 'ritual' | 'conc' | 'ed' | 'mat';

const KEYS: [RegExp, Key][] = [
  [/^(название|имя|name)$/, 'name'],
  [/^(оригинал|англ\.?( название)?|английское название|english|original)$/, 'orig'],
  [/^(круг|уровень|level|lvl)$/, 'lvl'],
  [/^(школа|school)$/, 'school'],
  [/^(время( накладывания| сотворения| каста)?|каст|действие|casting time|time)$/, 'time'],
  [/^(дистанция|дальность|range)$/, 'range'],
  [/^(компоненты|components)$/, 'comps'],
  [/^(материалы|материальный компонент|material)$/, 'mat'],
  [/^(длительность|duration)$/, 'dur'],
  [/^(цель|цели|target)$/, 'target'],
  [/^(площадь|область|зона|area)$/, 'area'],
  [/^(атака\s*\/\s*спасбросок|атака или спасбросок|спасбросок|атака|эффект|бросок|attack\/save|save)$/, 'effect'],
  [/^(классы|класс|classes)$/, 'cls'],
  [/^(источник|книга|source)$/, 'src'],
  [/^(описание|текст|description|text)$/, 'text'],
  [/^(ритуал|ritual)$/, 'ritual'],
  [/^(концентрация|concentration)$/, 'conc'],
  [/^(редакция|edition)$/, 'ed'],
];

const keyOf = (raw: string): Key | undefined => {
  const k = raw.toLowerCase().replace(/[*_`#]/g, '').replace(/ё/g, 'е').trim();
  return KEYS.find(([re]) => re.test(k))?.[1];
};

const SCHOOL_STEMS: [string, string][] = [
  ['огражд', 'abjuration'], ['abjur', 'abjuration'], ['вызов', 'conjuration'], ['призыв', 'conjuration'], ['conj', 'conjuration'],
  ['прориц', 'divination'], ['divin', 'divination'], ['очаров', 'enchantment'], ['enchant', 'enchantment'],
  ['вопло', 'evocation'], ['evoc', 'evocation'], ['иллюз', 'illusion'], ['illus', 'illusion'],
  ['некро', 'necromancy'], ['necro', 'necromancy'], ['преобр', 'transmutation'], ['трансм', 'transmutation'], ['transm', 'transmutation'],
];
const CLASS_STEMS: [string, string][] = [
  ['бард', 'bard'], ['bard', 'bard'], ['жрец', 'cleric'], ['клирик', 'cleric'], ['cleric', 'cleric'], ['друид', 'druid'], ['druid', 'druid'],
  ['паладин', 'paladin'], ['paladin', 'paladin'], ['следопыт', 'ranger'], ['рейнджер', 'ranger'], ['ranger', 'ranger'],
  ['чародей', 'sorcerer'], ['сорсер', 'sorcerer'], ['sorcer', 'sorcerer'], ['колдун', 'warlock'], ['варлок', 'warlock'], ['warlock', 'warlock'],
  ['волшебн', 'wizard'], ['маг', 'wizard'], ['wizard', 'wizard'], ['изобрет', 'artificer'], ['артифи', 'artificer'], ['artific', 'artificer'],
];

const school = (s: string) => {
  const t = s.toLowerCase();
  return SCHOOL_STEMS.find(([st]) => t.includes(st))?.[1] ?? (Object.keys(SCHOOLS).includes(t) ? t : 'evocation');
};
const classes = (s: string) => [...new Set(s.split(/[,;/]|\s+и\s+/).map((x) => x.trim().toLowerCase()).filter(Boolean)
  .map((x) => CLASS_STEMS.find(([st]) => x.startsWith(st))?.[1] ?? x))];
const yes = (s: string) => /^(да|есть|yes|true|\+|1)/i.test(s.trim());

const slug = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, '-').replace(/^-|-$/g, '');

export interface ParsedSpell { spell: SpellData; warn: string[] }

function build(f: Partial<Record<Key, string>>, ed: '2014' | '2024'): ParsedSpell | null {
  const ru = f.name?.trim();
  if (!ru) return null;
  const warn: string[] = [];
  const lvlRaw = (f.lvl ?? '').toLowerCase();
  const lvlNum = lvlRaw.match(/\d/);
  const lvl = /заговор|cantrip|фокус/.test(lvlRaw) ? 0 : lvlNum ? Math.min(9, +lvlNum[0]) : NaN;
  if (Number.isNaN(lvl)) warn.push('нет круга — поставил 1');
  const comps = f.comps ?? '';
  const mm = comps.match(/[МM]\s*\(([\s\S]*)\)/);
  const m = (f.mat ?? mm?.[1] ?? '').trim() || (/(^|[\s,])[МM]($|[\s,])/.test(comps) ? 'материальный компонент' : undefined);
  const dur = (f.dur ?? '').trim();
  const time = (f.time ?? '').trim();
  const edition = /2024/.test(f.ed ?? '') ? '2024' : /2014/.test(f.ed ?? '') ? '2014' : ed;
  const orig = f.orig?.trim();
  if (!f.text?.trim()) warn.push('нет описания');
  const spell: SpellData = {
    id: `user:${edition}:${slug(ru)}`, ed: edition, src: f.src?.trim() || 'Добавлено списком',
    name: orig || ru, ru: orig ? ru : undefined,
    lvl: Number.isNaN(lvl) ? 1 : lvl, school: school(f.school ?? ''),
    time: time || '1 действие', range: (f.range ?? '').trim() || '—',
    v: /(^|[\s,])[ВV]($|[\s,(])/.test(comps) ? 1 : 0, s: /(^|[\s,])[СS]($|[\s,(])/.test(comps) ? 1 : 0, m,
    dur: dur || 'Мгновенная',
    c: /концентрац|concentrat/i.test(dur) || (f.conc ? yes(f.conc) : false) ? 1 : 0,
    r: /ритуал|ritual/i.test(time + ' ' + (f.lvl ?? '') + ' ' + (f.school ?? '')) || (f.ritual ? yes(f.ritual) : false) ? 1 : 0,
    cls: classes(f.cls ?? ''), text: (f.text ?? '').trim(),
  };
  if (f.target?.trim()) spell.target = f.target.trim();
  if (f.area?.trim()) spell.area = f.area.trim();
  if (f.effect?.trim()) spell.effect = f.effect.trim();
  return { spell, warn };
}

/** JSON: массив объектов с русскими или английскими ключами. */
function fromJson(src: string, ed: '2014' | '2024'): ParsedSpell[] | null {
  let data: unknown;
  try { data = JSON.parse(src); } catch { return null; }
  const arr = Array.isArray(data) ? data : data && typeof data === 'object' && Array.isArray((data as { spells?: unknown }).spells) ? (data as { spells: unknown[] }).spells : [data];
  const out: ParsedSpell[] = [];
  for (const o of arr) {
    if (!o || typeof o !== 'object') continue;
    const f: Partial<Record<Key, string>> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const key = keyOf(k) ?? (k === 'ru' ? 'name' : k === 'dur' ? 'dur' : undefined);
      if (!key || v == null) continue;
      f[key] = Array.isArray(v) ? v.join(', ') : String(v);
    }
    const p = build(f, ed);
    if (p) out.push(p);
  }
  return out;
}

export function parseSpells(src: string, ed: '2014' | '2024' = '2014'): ParsedSpell[] {
  const t = src.trim();
  if (!t) return [];
  if (/^[[{]/.test(t)) { const j = fromJson(t, ed); if (j) return j; }
  const out: ParsedSpell[] = [];
  let cur: Partial<Record<Key, string>> = {};
  let last: Key | undefined;
  const flush = () => { const p = build(cur, ed); if (p) out.push(p); cur = {}; last = undefined; };
  for (const raw of t.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').replace(/\*\*/g, '');
    if (/^\s*([-—–=*_]\s*){3,}$/.test(raw)) { flush(); continue; }
    const kv = line.match(/^\s*([^:：]{2,40})[:：]\s*(.*)$/);
    const key = kv ? keyOf(kv[1]) : undefined;
    if (key && kv) {
      if (key === 'name' && cur.name) flush();
      cur[key] = kv[2];
      last = key;
      continue;
    }
    if (last) {
      // продолжение предыдущего поля: описание — с переносами, остальное через пробел
      if (last === 'text') cur.text = (cur.text ?? '') + '\n' + raw.trim();
      else if (raw.trim()) cur[last] = `${cur[last] ?? ''} ${raw.trim()}`.trim();
    }
  }
  flush();
  out.forEach((p) => { p.spell.text = p.spell.text.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/(\S)\n(?=\S)/g, '$1\n\n'); });
  return out;
}
