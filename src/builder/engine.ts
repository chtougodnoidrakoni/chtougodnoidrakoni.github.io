// Расчёт персонажа из выборов игрока. Чистые функции — их же проверяют тесты.
import { ABS, AB_RU, ARMORS, BACKGROUNDS, CLASSES, DRAGONS, RACES, SKILLS, WEAPONS, slots, spellRule, type Ab, type ClassDef, type Ed, type Race, type Sub, type Background, type SpellRule } from './data';

export type Method = 'standard' | 'pointbuy' | 'roll' | 'manual';
export interface AsiPick { mode: 'two' | 'one' | 'feat'; a?: Ab; b?: Ab; feat?: string }
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

export const classOf = (b: Build): ClassDef | undefined => CLASSES.find((c) => c.id === b.cls);
export const raceOf = (b: Build): Race | undefined => RACES[b.ed].find((r) => r.id === b.race);
export const subOf = (b: Build): Sub | undefined => raceOf(b)?.subs?.find((s) => s.id === b.sub);
export const bgOf = (b: Build): Background | undefined => BACKGROUNDS[b.ed].find((x) => x.id === b.bg);
export const subAt = (c: ClassDef, ed: Ed) => (ed === '2014' ? c.sub.at14 : c.sub.at24);
export const subName = (b: Build) => { const c = classOf(b); if (!c || b.level < subAt(c, b.ed)) return ''; return b.subclass === 'custom' ? (b.customSub ?? '').trim() : b.subclass ? (b.ed === '2014' ? c.sub.name14 : c.sub.name24) : ''; };
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
  }
  return s;
}

export function feats(b: Build): string[] {
  const out: string[] = [];
  const bg = bgOf(b);
  if (b.ed === '2024') { const f = bg?.custom ? b.bgFeat : bg?.feat; if (f) out.push(`${f} (предыстория)`); }
  if (raceOf(b)?.originFeat && b.originFeat) out.push(`${b.originFeat} (человек)`);
  for (const l of asiLevels(b)) { const p = b.asi[l]; if (p?.mode === 'feat' && p.feat?.trim()) out.push(`${p.feat.trim()} (${l} ур.)`); if (b.ed === '2024' && l === 19 && p?.feat?.trim() && p.mode !== 'feat') out.push(`Эпический дар: ${p.feat.trim()}`); }
  if (b.style) out.push(`Боевой стиль: ${b.style.replace(/\s*\(.*\)/, '')}`);
  return out;
}
const hasFeat = (b: Build, name: string) => feats(b).some((f) => f.startsWith(name));

/** Навыки с владением: класс + предыстория + раса + черта «Одарённый». */
export function allSkills(b: Build): string[] {
  const r = raceOf(b), bg = bgOf(b);
  const set = new Set<string>([...b.skills, ...(bg?.custom ? b.bgSkills : bg?.skills ?? []), ...(r?.skills ?? []), ...(subOf(b)?.skills ?? []), ...b.raceSkills]);
  if (hasFeat(b, 'Одарённый')) b.skilledFeat.forEach((s) => set.add(s));
  return [...set];
}
/** Навыки, занятые не классом (чтобы не выбрать их второй раз). */
export function fixedSkills(b: Build): string[] {
  const r = raceOf(b), bg = bgOf(b);
  return [...new Set([...(bg?.custom ? b.bgSkills : bg?.skills ?? []), ...(r?.skills ?? []), ...b.raceSkills])];
}

export function expertiseCount(b: Build): number {
  const c = classOf(b); const t = c?.expertise?.[b.ed]; if (!t) return 0;
  return Object.entries(t).filter(([l]) => +l <= b.level).reduce((s, [, n]) => s + n, 0);
}

export function maxHp(b: Build): number {
  const c = classOf(b); if (!c) return 0;
  const con = mod(scores(b).con);
  const per = b.hp === 'max' ? c.hd : c.hd / 2 + 1;
  let hp = c.hd + con + (b.level - 1) * (per + con);
  hp += ((raceOf(b)?.hpPerLevel ?? 0) + (subOf(b)?.hpPerLevel ?? 0)) * b.level;
  if (c.id === 'sorcerer' && subName(b) && b.subclass !== 'custom') hp += b.level; // драконья стойкость
  return Math.max(b.level, hp);
}

export function speed(b: Build): number {
  const c = classOf(b); let s = subOf(b)?.speed ?? raceOf(b)?.speed ?? 30;
  const armor = ARMORS.find((a) => a.id === b.armor);
  if (c?.id === 'monk' && !armor && !b.shield && b.level >= 2) s += b.level >= 18 ? 30 : b.level >= 14 ? 25 : b.level >= 10 ? 20 : b.level >= 6 ? 15 : 10;
  if (c?.id === 'barbarian' && b.level >= 5 && armor?.kind !== 'heavy') s += 10;
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
  if (c?.id === 'sorcerer' && subName(b) && b.subclass !== 'custom') opts.push([13 + dex + shield, `драконья чешуя (13 + ЛОВ)${shield ? ' + щит' : ''}`]);
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
  if (rule === 'simple') return !w.martial;
  if (rule === 'light') return !w.martial || !!w.light;
  if (rule === 'finesse-light') return !w.martial || !!w.finesse || !!w.light;
  return (['bard', 'rogue', 'monk'].includes(c.id) && !w.martial) || rule.includes(name);
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
  const t = b.ed === '2014' ? c.feat14 : c.feat24; const sn = subName(b);
  const out: string[] = [];
  for (let l = 1; l <= b.level; l++) {
    const f = (t[l] ?? []).map((x) => (x.startsWith('★') ? `умение подкласса${sn ? ` «${sn}»` : ''}` : x.endsWith('выбор подкласса') && sn ? `${x.replace(' — выбор подкласса', '')}: ${sn}` : x));
    if (asiLevels(b).includes(l) && !(b.ed === '2024' && l === 19)) f.push('Увеличение характеристик или черта');
    if (f.length) out.push(`${l} ур.: ${f.join('; ')}`);
  }
  return out;
}

export function dragonType(b: Build): string { return DRAGONS.find((d) => d[0] === b.dragon)?.[1] ?? ''; }

/** Что ещё не выбрано — по шагам. Пустой список значит «можно создавать лист». */
export function problems(b: Build): Record<string, string[]> {
  const p: Record<string, string[]> = {};
  const add = (k: string, m: string) => (p[k] ??= []).push(m);
  const c = classOf(b), r = raceOf(b), bg = bgOf(b);
  if (!c) add('class', 'Выберите класс');
  else if (b.level >= subAt(c, b.ed) && !subName(b)) add('class', `Выберите ${c.sub.title.toLowerCase()}`);
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
    if (b.ed === '2024') {
      if (b.bgMode === '21' && (!b.bgPlus2 || !b.bgPlus1 || b.bgPlus1 === b.bgPlus2)) add('bg', 'Распределите +2 и +1');
      if (b.bgMode === '111' && b.bgAbs.length < 3) add('bg', 'Выберите три характеристики для +1');
      if (bg.custom && !b.bgFeat) add('bg', 'Выберите черту происхождения');
    }
  }
  if (ABS.some((a) => b.base[a] === undefined)) add('abil', 'Задайте все шесть характеристик');
  if (b.method === 'pointbuy' && ABS.reduce((s, a) => s + (POINT_COST[b.base[a] ?? 8] ?? 0), 0) > 27) add('abil', 'Потрачено больше 27 очков');
  for (const l of asiLevels(b)) { const x = b.asi[l]; if (!x || (x.mode === 'one' && !x.a) || (x.mode === 'two' && (!x.a || !x.b)) || (x.mode === 'feat' && !x.feat?.trim())) add('asi', `${l} уровень: сделайте выбор`); }
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
