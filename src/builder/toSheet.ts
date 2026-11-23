// Собранный персонаж → лист клуба (тот же формат, что у автозаполнения от нейросети).
import { applyAi } from '../aiImport';
import { clubTemplate, uid, type Sheet, type SheetSpell, type SpellData } from '../model';
import { ABS, AB_RU, SKILLS, type Ab } from './data';
import { allSkills, armorClass, attacks, bgOf, classOf, dragonType, feats, features, maxHp, mod, pb, raceOf, rule, scores, sgn, slots, speed, subName, subOf, type Build } from './engine';

export function racialSpells(b: Build, db: SpellData[]): SpellData[] {
  const list = [...(raceOf(b)?.spells ?? []), ...(subOf(b)?.spells ?? [])].filter(([, at]) => b.level >= at);
  return list.map(([en]) => db.find((s) => s.ed === b.ed && s.name === en) ?? db.find((s) => s.name === en)).filter((s): s is SpellData => !!s);
}

export function buildData(b: Build): Record<string, unknown> {
  const c = classOf(b)!; const r = raceOf(b)!; const sub = subOf(b); const bg = bgOf(b)!;
  const s = scores(b); const p = pb(b.level); const sk = allSkills(b);
  const ac = armorClass(b); const hp = maxHp(b);
  const perception = 10 + mod(s.wis) + (sk.includes('Внимательность') ? p * (b.expertise.includes('Внимательность') ? 2 : 1) : 0);
  const alert = feats(b).some((f) => f.startsWith('Бдительный'));
  const ab = (a: Ab) => ({ значение: s[a], спасбросок: c.saves.includes(a), навыки: SKILLS.filter(([n, x]) => x === a && sk.includes(n)).map(([n]) => n) });
  const sr = rule(b); const sl = slots(c, b.ed, b.level);
  const raceName = [sub?.name ?? r.name, r.dragon && b.dragon ? `(${b.dragon.toLowerCase()} предок, ${dragonType(b)})` : ''].filter(Boolean).join(' ');
  const traits = [...r.traits, ...(sub?.traits ?? [])].map((t) => `${t.name}. ${t.text}`).join('\n');
  const arm = attacks(b).map((a) => [a.name, a.dmg, sgn(a.bonus), '', a.type]);
  const prof = [
    `Доспехи: ${c.armor}`,
    `Оружие: ${b.ed === '2024' && c.weapons24 ? { martial: 'простое и воинское', simple: 'простое', light: 'простое и воинское с лёгким свойством', 'finesse-light': 'простое и воинское с фехтовальным или лёгким свойством' }[c.weapons24] : c.weapons === 'martial' ? 'простое и воинское' : c.weapons === 'simple' ? 'простое' : `${['bard', 'rogue', 'monk'].includes(c.id) ? 'простое, ' : ''}${(c.weapons as string[]).join(', ').toLowerCase()}`}`,
    [c.tools, bg.tool].filter(Boolean).length ? `Инструменты: ${[c.tools, bg.tool].filter(Boolean).join(', ')}` : '',
    b.expertise.length ? `Компетентность: ${b.expertise.join(', ')}` : '',
  ].filter(Boolean).join('\n');
  const gear = [ac.how.startsWith('без') || ac.how.startsWith('защита') || ac.how.startsWith('драконья') ? '' : ac.how.replace(' + стиль «Защита»', ''), b.weapons.join(', '), c.kit, bg.gear].filter(Boolean).join('\n');
  const slotObj = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`${i + 1} круг`, sl[i] ?? 0]));
  const story = [b.personality.trim()].filter(Boolean).join('\n');
  return {
    'Имя персонажа': b.name.trim(), 'Уровень': String(b.level), 'Класс': c.name, 'Вид': raceName,
    'Предыстория': bg.custom ? (b.bgName?.trim() || 'Своя предыстория') : bg.name, 'Мировоззрение': b.alignment, 'Возраст': b.age, 'Игрок': b.player,
    'Внешность': b.appearance, 'Черты характера и манеры': story, 'Предыстория персонажа': b.backstory,
    'Класс доспеха': String(ac.ac), 'Инициатива': sgn(mod(s.dex) + (alert ? p : 0)), 'Скорость': `${speed(b)} фт.`, 'Бонус мастерства': sgn(p), 'Пасс. внимательность': String(perception),
    ...Object.fromEntries(ABS.map((a) => [AB_RU[a], ab(a)])),
    'Максимум хитов': String(hp), 'Текущие хиты': String(hp), 'Кости хитов': `${b.level}к${c.hd}`,
    'Снаряжение': gear, 'Владения': prof, 'Языки': r.langs + (bg.langs ? `; ${bg.langs}` : ''),
    'Оружие': arm,
    'Способности класса и подкласса': { 'Класс': features(b).join('\n'), 'Подкласс': subName(b) },
    'Способности вида и предыстории': { 'Вид': traits, 'Предыстория': [bg.feature, b.ed === '2024' && !bg.custom ? `Черта: ${bg.feat}` : ''].filter(Boolean).join('\n') },
    'Черты и дополнительные способности': { 'Черты': feats(b).join('\n'), 'Дополнительно': '' },
    ...(sr && c.spellAb ? {
      'Заклинательный класс': c.name, 'Характеристика': AB_RU[c.spellAb],
      'СЛ спасброска': String(8 + p + mod(s[c.spellAb])), 'Бонус атаки': sgn(p + mod(s[c.spellAb])), 'Ячейки заклинаний': slotObj,
    } : {}),
  };
}

export function toSheet(b: Build, db: SpellData[]): Sheet {
  const base = clubTemplate();
  const { sheet } = applyAi(base, buildData(b), db);
  const c = classOf(b)!;
  const byId = new Map(db.map((s) => [s.id, s]));
  const book = rule(b)?.book;
  const spells: SheetSpell[] = [];
  const push = (id: string, prepared: boolean) => { if (byId.has(id) && !spells.some((x) => x.ref === id)) spells.push({ key: uid(), ref: id, prepared }); };
  b.cantrips.forEach((id) => push(id, true));
  b.spells.forEach((id) => push(id, book ? b.prepared.includes(id) : true));
  b.arcanum.forEach((id) => push(id, true));
  racialSpells(b, db).forEach((sp) => push(sp.id, true));
  return { ...sheet, name: b.name.trim() || 'Новый персонаж', spells, dnd: { classes: [{ id: c.id, level: b.level }] }, updatedAt: Date.now() };
}
