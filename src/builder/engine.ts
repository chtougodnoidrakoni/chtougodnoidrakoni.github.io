// Расчёт персонажа из выборов игрока. Чистые функции — их же проверяют тесты.
import { abOf, backgroundsFor, classesFor, featsFor, findSub, racesFor, type Effect, type SubDef } from './content';
import type { FeatDef } from './data';
import { ABS, AB_RU, ARMORS, DRAGONS, SKILLS, WEAPONS, slots, spellRule, type Ab, type ClassDef, type Ed, type Race, type Sub, type Background, type SpellRule } from './data';

export type Method = 'standard' | 'pointbuy' | 'roll' | 'manual';
export interface AsiPick { mode: 'two' | 'one' | 'feat'; a?: Ab; b?: Ab; feat?: string; featId?: string; featAb?: Ab }
export interface Build {
  ed: Ed; level: number; hp: 'avg' | 'max';
  cls?: string; subclass?: string; customSub?: string; style?: string;
  race?: string; sub?: string; dragon?: string; raceAsi: Ab[]; raceSkills: string[]; originFeat?: string;
  bg?: string; bgName?: string; bgSkills: string[]; bgMode: '21' | '111'; bgPlus2?: Ab; bgPlus1?: Ab; bgAbs: Ab[]; bgFeat?: string;
  method: Method; base: Record<Ab, number | undefined>; rolled: number[];
  asi: Record<number, AsiPick>;
  skills: string[]; expertise: string[]; skilledFeat: string[];
  cantrips: string[]; spells: string[]; prepared: string[]; arcanum: string[];
  armor?: string; shield: boolean; weapons: string[];
  name: string; player: string; alignment: string; age: string; appearance: string; personality: string; backstory: string;
}
export const emptyBuild = (): Build => ({
  ed: '2014', level: 1, hp: 'avg', raceAsi: [], raceSkills: [], bgSkills: [], bgMode: '21', bgAbs: [],
  method: 'standard', base: { str: undefined, dex: undefined, con: undefined, int: undefined, wis: undefined, cha: undefined }, rolled: [],
  asi: {}, skills: [], expertise: [], skilledFeat: [], cantrips: [], spells: [], prepared: [], arcanum: [], shield: false, weapons: [],
  name: '', player: '', alignment: '', age: '', appearance: '', personality: '', backstory: '',
});

export const mod = (v: number) => Math.floor((v - 10) / 2);
export const sgn = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);
export const pb = (l: number) => 2 + Math.floor((l - 1) / 4);
export const STANDARD = [15, 14, 13, 12, 10, 8];
export const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export const classOf = (b: Build): ClassDef | undefined => classesFor(b.ed).find((c) => c.id === b.cls);
/** Подкласс из пакета контента, если выбран он. */
export const packSub = (b: Build): SubDef | undefined => (b.subclass && b.subclass !== 'srd' && b.subclass !== 'custom' ? findSub(b.ed, b.subclass) : undefined);
export const raceOf = (b: Build): Race | undefined => racesFor(b.ed).find((r) => r.id === b.race);
export const subOf = (b: Build): Sub | undefined => raceOf(b)?.subs?.find((s) => s.id === b.sub);
export const bgOf = (b: Build): Background | undefined => backgroundsFor(b.ed).find((x) => x.id === b.bg);
export const featById = (b: Build, id?: string): FeatDef | undefined => (id ? featsFor(b.ed).find((f) => f.id === id) : undefined);
export const subAt = (c: ClassDef, ed: Ed, s?: SubDef) => s?.level ?? (ed === '2014' ? c.sub.at14 : c.sub.at24);
export const subName = (b: Build) => {
  const c = classOf(b); const ps = packSub(b); if (!c || b.level < subAt(c, b.ed, ps)) return '';
  if (ps) return ps.name;
  return b.subclass === 'custom' ? (b.customSub ?? '').trim() : b.subclass === 'srd' ? (b.ed === '2014' ? c.sub.name14 : c.sub.name24) : '';
};
/** Механические эффекты способностей из пакетов, открытых к текущему уровню. */
export function effects(b: Build): Effect[] {
  const c = classOf(b); const ps = packSub(b); const out: Effect[] = [...(raceOf(b)?.effects ?? []), ...(subOf(b)?.effects ?? [])];
  for (const f of c?.fdefs ?? []) if (f.level <= b.level) out.push(...f.effects);
  if (ps && c && b.level >= subAt(c, b.ed, ps)) for (const f of ps.features) if (f.level <= b.level) out.push(...f.effects);
  for (const l of asiLevels(b)) { const p = b.asi[l]; if (p?.mode === 'feat') out.push(...(featById(b, p.featId)?.effects ?? [])); }
  return out;
}
const eff = <T extends Effect['type']>(b: Build, t: T) => effects(b).filter((e): e is Extract<Effect, { type: T }> => e.type === t);
export const asiLevels = (b: Build) => { const c = classOf(b); return c ? (b.ed === '2014' ? c.asi14 : [...c.asi24, 19]).filter((l) => l <= b.level) : []; };

/** Бонусы к характеристикам от расы (2014) или предыстории (2024). */
export function originBonus(b: Build): Record<Ab, number> {
  const o = Object.fromEntries(ABS.map((a) => [a, 0])) as Record<Ab, number>;
  if (b.ed === '2014') {
    const r = raceOf(b);
    for (const [a, v] of Object.entries(r?.asi ?? {})) o[a as Ab] += v!;
    for (const [a, v] of Object.entries(subOf(b)?.asi ?? {})) o[a as Ab] += v!;
    if (r?.asiChoice) b.raceAsi.slice(0, r.asiChoice.n).forEach((a) => (o[a] += r.asiChoice!.v));
  } else {
    for (const [a, v] of Object.entries(raceOf(b)?.asi ?? {})) o[a as Ab] += v!;
    for (const [a, v] of Object.entries(subOf(b)?.asi ?? {})) o[a as Ab] += v!;
    if (b.bgMode === '21') { if (b.bgPlus2) o[b.bgPlus2] += 2; if (b.bgPlus1 && b.bgPlus1 !== b.bgPlus2) o[b.bgPlus1] += 1; }
    else b.bgAbs.slice(0, 3).forEach((a) => (o[a] += 1));
  }
  return o;
}

/** Итоговые характеристики: основа + происхождение + улучшения по уровням (потолок 20, эпический дар — 30). */
export function scores(b: Build): Record<Ab, number> {
  const ob = originBonus(b);
  const s = Object.fromEntries(ABS.map((a) => [a, (b.base[a] ?? 10) + ob[a]])) as Record<Ab, number>;
  for (const l of asiLevels(b)) {
    const p = b.asi[l]; if (!p) continue;
    const cap = b.ed === '2024' && l === 19 ? 30 : 20;
    if (p.mode === 'one' && p.a) s[p.a] = Math.min(cap, s[p.a] + (b.ed === '2024' && l === 19 ? 1 : 2));
    if (p.mode === 'two') { if (p.a) s[p.a] = Math.min(cap, s[p.a] + 1); if (p.b && p.b !== p.a) s[p.b] = Math.min(cap, s[p.b] + 1); }
    if (p.mode === 'feat') { const f = featById(b, p.featId); if (f?.asi && p.featAb && f.asi.abilities.includes(p.featAb)) s[p.featAb] = Math.min(cap, s[p.featAb] + f.asi.value); }
  }
  return s;
}

export function feats(b: Build): string[] {
  const out: string[] = [];
  const bg = bgOf(b);
  if (b.ed === '2024') { const f = bg?.custom ? b.bgFeat : bg?.feat; if (f) out.push(`${featById(b, f)?.name ?? f} (предыстория)`); }
  if (raceOf(b)?.originFeat && b.originFeat) out.push(`${b.originFeat} (человек)`);
  for (const l of asiLevels(b)) { const p = b.asi[l]; const fd = p?.mode === 'feat' ? featById(b, p.featId) : undefined; if (fd) out.push(`${fd.name}${fd.asi && p?.featAb ? ` (+${fd.asi.value} ${AB_RU[p.featAb]})` : ''} (${l} ур.)`); else if (p?.mode === 'feat' && p.feat?.trim()) out.push(`${p.feat.trim()} (${l} ур.)`); if (b.ed === '2024' && l === 19 && p?.feat?.trim() && p.mode !== 'feat') out.push(`Эпический дар: ${p.feat.trim()}`); }
  if (b.style) out.push(`Боевой стиль: ${b.style.replace(/\s*\(.*\)/, '')}`);
  return out;
}
const hasFeat = (b: Build, name: string) => feats(b).some((f) => f.startsWith(name));

/** Навыки с владением: класс + предыстория + раса + черта «Одарённый». */
export function allSkills(b: Build): string[] {
  const r = raceOf(b), bg = bgOf(b);
  const set = new Set<string>([...b.skills, ...(bg?.custom ? b.bgSkills : [...(bg?.skills ?? []), ...(bg?.skillChoice ? b.bgSkills : [])]), ...(r?.skills ?? []), ...(subOf(b)?.skills ?? []), ...b.raceSkills]);
  if (hasFeat(b, 'Одарённый')) b.skilledFeat.forEach((s) => set.add(s));
  eff(b, 'skill_proficiency').forEach((e) => e.value.forEach((s) => set.add(s)));
  return [...set];
}
/** Навыки, занятые не классом (чтобы не выбрать их второй раз). */
export function fixedSkills(b: Build): string[] {
  const r = raceOf(b), bg = bgOf(b);
  return [...new Set([...(bg?.custom ? b.bgSkills : [...(bg?.skills ?? []), ...(bg?.skillChoice ? b.bgSkills : [])]), ...(r?.skills ?? []), ...b.raceSkills])];
}

export function expertiseCount(b: Build): number {
  const c = classOf(b); const t = c?.expertise?.[b.ed] ?? {};
  return Object.entries(t).filter(([l]) => +l <= b.level).reduce((s, [, n]) => s + n, 0) + eff(b, 'expertise').reduce((s, e) => s + e.count, 0);
}

export function maxHp(b: Build): number {
  const c = classOf(b); if (!c) return 0;
  const con = mod(scores(b).con);
  const per = b.hp === 'max' ? c.hd : c.hd / 2 + 1;
  let hp = c.hd + con + (b.level - 1) * (per + con);
  hp += ((raceOf(b)?.hpPerLevel ?? 0) + (subOf(b)?.hpPerLevel ?? 0)) * b.level;
  if (c.id === 'sorcerer' && b.subclass === 'srd' && subName(b)) hp += b.level; // драконья стойкость
  hp += eff(b, 'hp_per_level').reduce((s, e) => s + e.value, 0) * b.level;
  return Math.max(b.level, hp);
}

export function speed(b: Build): number {
  const c = classOf(b); let s = subOf(b)?.speed ?? raceOf(b)?.speed ?? 30;
  const armor = ARMORS.find((a) => a.id === b.armor);
  if (c?.id === 'monk' && !armor && !b.shield && b.level >= 2) s += b.level >= 18 ? 30 : b.level >= 14 ? 25 : b.level >= 10 ? 20 : b.level >= 6 ? 15 : 10;
  if (c?.id === 'barbarian' && b.level >= 5 && armor?.kind !== 'heavy') s += 10;
  for (const e of eff(b, 'speed')) if (!e.condition || (e.condition === 'no_armor' && !armor) || (e.condition === 'no_heavy_armor' && armor?.kind !== 'heavy')) s += e.value;
  return s;
}

export function armorClass(b: Build): { ac: number; how: string } {
  const c = classOf(b); const s = scores(b); const dex = mod(s.dex);
  const armor = ARMORS.find((a) => a.id === b.armor);
  const shield = b.shield ? 2 : 0;
  const def = b.style?.startsWith('Защита') && armor ? 1 : 0;
  if (armor) {
    const d = armor.dexCap === undefined ? dex : Math.min(dex, armor.dexCap);
    return { ac: armor.ac + d + shield + def, how: `${armor.name}${shield ? ' + щит' : ''}${def ? ' + стиль «Защита»' : ''}` };
  }
  const opts: [number, string][] = [[10 + dex + shield, `без доспеха${shield ? ' + щит' : ''}`]];
  if (c?.id === 'barbarian') opts.push([10 + dex + mod(s.con) + shield, `защита без доспехов (ЛОВ + ТЕЛ)${shield ? ' + щит' : ''}`]);
  if (c?.id === 'monk' && !b.shield) opts.push([10 + dex + mod(s.wis), 'защита без доспехов (ЛОВ + МДР)']);
  for (const e of eff(b, 'unarmored_ac')) { const v = e.base + e.abilities.reduce((t, a) => t + (abOf(a) ? mod(s[abOf(a)!]) : 0), 0) + (e.shield === false ? 0 : shield); if (e.shield !== false || !b.shield) opts.push([v, `защита без доспехов (${e.base} + ${e.abilities.map((a) => AB_RU[abOf(a)!]?.slice(0, 3).toUpperCase()).join(' + ')})`]); }
  if (c?.id === 'sorcerer' && b.subclass === 'srd' && subName(b)) opts.push([13 + dex + shield, `драконья чешуя (13 + ЛОВ)${shield ? ' + щит' : ''}`]);
  const best = opts.sort((x, y) => y[0] - x[0])[0]!;
  return { ac: best[0], how: best[1] };
}

export function proficientWeapon(b: Build, name: string): boolean {
  const c = classOf(b); const w = WEAPONS.find((x) => x.name === name); if (!c || !w) return false;
  const r = raceOf(b);
  if (b.ed === '2014' && r?.id === 'dwarf' && ['Боевой топор', 'Ручной топор', 'Лёгкий молот', 'Боевой молот'].includes(name)) return true;
  if (b.ed === '2014' && b.sub === 'high' && ['Длинный меч', 'Короткий меч', 'Длинный лук', 'Короткий лук'].includes(name)) return true;
  const rule = b.ed === '2024' && c.weapons24 ? c.weapons24 : c.weapons;
  if (rule === 'martial') return true;
  const extra = eff(b, 'weapon_proficiency').flatMap((e) => e.value.map((x) => x.toLowerCase()));
  if (extra.includes('martial') || extra.includes(name.toLowerCase()) || (extra.includes('simple') && !w.martial)) return true;
  if (rule === 'simple') return !w.martial;
  if (rule === 'light') return !w.martial || !!w.light;
  if (rule === 'finesse-light') return !w.martial || !!w.finesse || !!w.light;
  const lc = name.toLowerCase();
  return ((c.simpleToo || ['bard', 'rogue', 'monk'].includes(c.id)) && !w.martial) || rule.some((x) => x.toLowerCase() === lc);
}

export interface Attack { name: string; bonus: number; dmg: string; type: string; props: string; prof: boolean }
export function attacks(b: Build): Attack[] {
  const s = scores(b); const p = pb(b.level); const c = classOf(b);
  const list: Attack[] = b.weapons.map((n) => {
    const w = WEAPONS.find((x) => x.name === n)!;
    const m = w.ranged && !w.finesse ? mod(s.dex) : w.finesse || (c?.id === 'monk' && !w.martial) ? Math.max(mod(s.str), mod(s.dex)) : mod(s.str);
    const prof = proficientWeapon(b, n);
    const arch = w.ranged && b.style?.startsWith('Стрельба') ? 2 : 0;
    return { name: w.name, bonus: m + (prof ? p : 0) + arch, dmg: `${w.dmg}${m ? sgn(m) : ''}`, type: w.type, props: w.props, prof };
  });
  if (c?.id === 'monk') {
    const die = b.ed === '2014' ? (b.level >= 17 ? '1к10' : b.level >= 11 ? '1к8' : b.level >= 5 ? '1к6' : '1к4') : (b.level >= 17 ? '1к12' : b.level >= 11 ? '1к10' : b.level >= 5 ? '1к8' : '1к6');
    const m = Math.max(mod(s.str), mod(s.dex));
    list.unshift({ name: 'Безоружный удар', bonus: m + p, dmg: `${die}${m ? sgn(m) : ''}`, type: 'дробящий', props: 'боевые искусства', prof: true });
  }
  return list;
}

export function rule(b: Build): SpellRule | undefined {
  const c = classOf(b); if (!c?.spellAb) return undefined;
  return spellRule(c, b.ed, b.level, mod(scores(b)[c.spellAb]));
}

export function features(b: Build): string[] {
  const c = classOf(b); if (!c) return [];
  const t = b.ed === '2014' ? c.feat14 : c.feat24; const sn = subName(b); const ps = packSub(b);
  const subOn = !!ps && b.level >= subAt(c, b.ed, ps);
  const out: string[] = [];
  for (let l = 1; l <= b.level; l++) {
    let f = (t[l] ?? []).map((x) => (x.endsWith('выбор подкласса') && sn ? `${x.replace(' — выбор подкласса', '')}: ${sn}` : x));
    if (subOn) {
      f = f.filter((x) => !x.startsWith('★'));
      f.push(...ps!.features.filter((x) => x.level === l).map((x) => `${x.name} (${ps!.name})`));
    } else f = f.map((x) => (x.startsWith('★') ? `умение подкласса${sn ? ` «${sn}»` : ''}` : x));
    if (asiLevels(b).includes(l) && !(b.ed === '2024' && l === 19)) f.push('Увеличение характеристик или черта');
    if (f.length) out.push(`${l} ур.: ${f.join('; ')}`);
  }
  return out;
}

/** Почему черта недоступна на уровне l (null — доступна). Характеристики берутся без улучшений этого и следующих уровней. */
export function prereqFail(b: Build, f: FeatDef, l: number): string | null {
  const before: Build = { ...b, level: l, asi: Object.fromEntries(Object.entries(b.asi).filter(([k]) => +k < l)) };
  const sc = scores(before);
  if (!f.repeatable && asiLevels(b).some((k) => k < l && b.asi[k]?.mode === 'feat' && b.asi[k]?.featId === f.id)) return 'уже взята раньше';
  for (const q of f.prereq) {
    if (q.type === 'ability') { const a = abOf(q.ability); if (a && sc[a] < q.min) return `нужно ${AB_RU[a]} ${q.min}+ (сейчас ${sc[a]})`; }
    if (q.type === 'ability_any') { const as = q.abilities.map((x) => abOf(x)).filter((x): x is Ab => !!x); if (!as.some((a) => sc[a] >= q.min)) return `нужно ${as.map((a) => AB_RU[a]).join(' или ')} ${q.min}+`; }
    if (q.type === 'level' && l < q.min) return `нужен ${q.min} уровень`;
    if (q.type === 'class' && !q.value.includes(b.cls ?? '')) return 'не подходит класс';
    if (q.type === 'race' && !q.value.includes(b.race ?? '') && !q.value.includes(b.sub ?? '')) return 'не подходит вид';
    if (q.type === 'spellcasting') { const c = classOf(b); const has = (c && slots(c, b.ed, l).length > 0) || !!(raceOf(b)?.spells?.length || subOf(b)?.spells?.length); if (!has) return 'нужно уметь накладывать заклинания'; }
    if (q.type === 'proficiency') { const ap = armorProf(before); const v = q.value.toLowerCase(); const ok = (['light', 'medium', 'heavy'].includes(v) && ap.kinds.has(v)) || (v === 'shields' && ap.shields) || allSkills(before).map((x) => x.toLowerCase()).includes(v); if (!ok) return `нужно владение: ${q.value}`; }
  }
  return null;
}

export function armorProf(b: Build): { kinds: Set<string>; shields: boolean } {
  const c = classOf(b); const extra = eff(b, 'armor_proficiency').flatMap((e) => e.value as string[]);
  return { kinds: new Set([...(c?.armorKinds ?? []), ...extra.filter((x) => x !== 'shields')]), shields: !!c?.shields || extra.includes('shields') };
}
export function saves(b: Build): Ab[] {
  const c = classOf(b); return [...new Set([...(c?.saves ?? []), ...eff(b, 'save_proficiency').flatMap((e) => e.value.map((a) => abOf(a)).filter((a): a is Ab => !!a))])];
}
/** Заклинания подкласса, которые всегда подготовлены (английские или русские названия из пакета). */
export function subSpells(b: Build): string[] {
  const c = classOf(b); const ps = packSub(b); if (!c || !ps || b.level < subAt(c, b.ed, ps)) return [];
  return ps.spells.filter((g) => g.level <= b.level).flatMap((g) => g.spells);
}
/** Описания способностей из пакетов, открытых к уровню. */
export function featureTexts(b: Build): { cls: string[]; sub: string[] } {
  const c = classOf(b); const ps = packSub(b);
  const fmt = (f: { name: string; level: number; text: string }) => `${f.name} (${f.level} ур.).${f.text ? ` ${f.text}` : ''}`;
  return {
    cls: (c?.fdefs ?? []).filter((f) => f.level <= b.level).map(fmt),
    sub: ps && c && b.level >= subAt(c, b.ed, ps) ? ps.features.filter((f) => f.level <= b.level).map(fmt) : [],
  };
}

export function dragonType(b: Build): string { return DRAGONS.find((d) => d[0] === b.dragon)?.[1] ?? ''; }

/** Что ещё не выбрано — по шагам. Пустой список значит «можно создавать лист». */
export function problems(b: Build): Record<string, string[]> {
  const p: Record<string, string[]> = {};
  const add = (k: string, m: string) => (p[k] ??= []).push(m);
  const c = classOf(b), r = raceOf(b), bg = bgOf(b);
  if (!c) add('class', 'Выберите класс');
  else if (b.level >= subAt(c, b.ed, packSub(b)) && !subName(b)) add('class', `Выберите ${c.sub.title.toLowerCase()}`);
  if (c?.style?.[b.ed] && b.level >= c.style[b.ed]! && !b.style) add('class', 'Выберите боевой стиль');
  if (!r) add('race', 'Выберите вид');
  else {
    if (r.subs && !subOf(b)) add('race', `Выберите: ${r.subTitle?.toLowerCase()}`);
    if (r.dragon && !b.dragon) add('race', 'Выберите драконьего предка');
    if (r.asiChoice && b.raceAsi.length < r.asiChoice.n) add('race', `Распределите +1 к ${r.asiChoice.n} характеристикам`);
    if (r.skillPick && b.raceSkills.length < r.skillPick.n) add('race', 'Выберите навык вида');
    if (r.originFeat && !b.originFeat) add('race', 'Выберите черту происхождения');
  }
  if (!bg) add('bg', 'Выберите предысторию');
  else {
    if (bg.custom && b.bgSkills.length < 2) add('bg', 'Выберите 2 навыка предыстории');
    if (bg.skillChoice && b.bgSkills.length < bg.skillChoice.choose) add('bg', `Навыки предыстории: выбрано ${b.bgSkills.length} из ${bg.skillChoice.choose}`);
    if (b.ed === '2024') {
      if (b.bgMode === '21' && (!b.bgPlus2 || !b.bgPlus1 || b.bgPlus1 === b.bgPlus2)) add('bg', 'Распределите +2 и +1');
      if (b.bgMode === '111' && b.bgAbs.length < 3) add('bg', 'Выберите три характеристики для +1');
      if (bg.custom && !b.bgFeat) add('bg', 'Выберите черту происхождения');
    }
  }
  if (ABS.some((a) => b.base[a] === undefined)) add('abil', 'Задайте все шесть характеристик');
  if (b.method === 'pointbuy' && ABS.reduce((s, a) => s + (POINT_COST[b.base[a] ?? 8] ?? 0), 0) > 27) add('abil', 'Потрачено больше 27 очков');
  for (const l of asiLevels(b)) {
    const x = b.asi[l]; const fd = x?.mode === 'feat' ? featById(b, x.featId) : undefined;
    if (!x || (x.mode === 'one' && !x.a) || (x.mode === 'two' && (!x.a || !x.b)) || (x.mode === 'feat' && !fd && !x.feat?.trim())) add('asi', `${l} уровень: сделайте выбор`);
    else if (fd) { const why = prereqFail(b, fd, l); if (why) add('asi', `${l} уровень: «${fd.name}» — ${why}`); if (fd.asi && !x.featAb) add('asi', `${l} уровень: выберите характеристику для +${fd.asi.value} от «${fd.name}»`); }
  }
  if (c && b.skills.length < c.skills.n) add('skills', `Навыки класса: выбрано ${b.skills.length} из ${c.skills.n}`);
  if (b.expertise.length < expertiseCount(b)) add('skills', `Компетентность: выбрано ${b.expertise.length} из ${expertiseCount(b)}`);
  if (hasFeat(b, 'Одарённый') && b.skilledFeat.length < 3) add('skills', 'Черта «Одарённый»: выберите 3 навыка');
  const sr = rule(b);
  if (sr) {
    if (b.cantrips.length < sr.cantrips) add('spells', `Заговоры: ${b.cantrips.length} из ${sr.cantrips}`);
    if (b.spells.length < sr.spells) add('spells', `Заклинания: ${b.spells.length} из ${sr.spells}`);
    if (b.arcanum.length < sr.arcanum.length) add('spells', `Таинственный арканум: ${b.arcanum.length} из ${sr.arcanum.length}`);
    if (sr.prepared && b.prepared.length < Math.min(sr.prepared, b.spells.length)) add('spells', `Подготовлено: ${b.prepared.length} из ${sr.prepared}`);
  }
  return p;
}

export const abilityLine = (b: Build) => { const s = scores(b); return ABS.map((a) => `${AB_RU[a].slice(0, 3).toUpperCase()} ${s[a]} (${sgn(mod(s[a]))})`).join(' · '); };
export { slots, SKILLS };

/** Какие характеристики важнее для класса — для кнопки «Расставить автоматически». */
const PRIORITY: Record<string, Ab[]> = {
  barbarian: ['str', 'con', 'dex', 'wis', 'cha', 'int'], bard: ['cha', 'dex', 'con', 'wis', 'int', 'str'],
  cleric: ['wis', 'con', 'str', 'dex', 'cha', 'int'], druid: ['wis', 'con', 'dex', 'int', 'cha', 'str'],
  fighter: ['str', 'con', 'dex', 'wis', 'int', 'cha'], monk: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
  paladin: ['str', 'cha', 'con', 'wis', 'dex', 'int'], ranger: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
  rogue: ['dex', 'con', 'wis', 'int', 'cha', 'str'], sorcerer: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
  warlock: ['cha', 'con', 'dex', 'wis', 'int', 'str'], wizard: ['int', 'con', 'dex', 'wis', 'cha', 'str'],
  artificer: ['int', 'con', 'dex', 'wis', 'cha', 'str'],
};
export function abilityPriority(b: Build): Ab[] {
  const cl = classOf(b);
  const base = (cl && PRIORITY[cl.id]) ?? [...(cl?.spellAb ? [cl.spellAb] : []), ...(cl?.saves ?? []), 'con', 'dex', 'wis', 'str', 'int', 'cha'] as Ab[];
  return [...new Set([...base, ...ABS])].slice(0, 6);
}
/** Раскладывает набор чисел: самое большое — в главную характеристику класса и дальше по важности. */
export function autoAssign(values: number[], b: Build): Record<Ab, number> {
  const v = [...values].sort((x, y) => y - x);
  return Object.fromEntries(abilityPriority(b).map((a, i) => [a, v[i] ?? 8])) as Record<Ab, number>;
}
