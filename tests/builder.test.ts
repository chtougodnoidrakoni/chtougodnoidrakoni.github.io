import { describe, expect, it } from 'vitest';
import { emptyBuild, scores, maxHp, armorClass, attacks, speed, rule, problems, allSkills, mod, features, type Build } from '../src/builder/engine';
import { spellRule, CLASSES, slots } from '../src/builder/data';
import { toSheet } from '../src/builder/toSheet';
import type { SpellData } from '../src/model';

const mk = (p: Partial<Build>): Build => ({ ...emptyBuild(), ...p });
const fighter = mk({ ed: '2014', level: 5, cls: 'fighter', subclass: 'srd', style: 'Защита (+1 к КД в доспехе)', race: 'dwarf', sub: 'hill', bg: 'acolyte',
  base: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 }, asi: { 4: { mode: 'one', a: 'str' } },
  skills: ['Атлетика', 'Внимательность'], armor: 'chainmail', shield: true, weapons: ['Длинный меч', 'Длинный лук'], name: 'Торин' });

describe('сборщик: расчёты', () => {
  it('дварф-воин 5 уровня', () => {
    const s = scores(fighter);
    expect(s.con).toBe(16); expect(s.wis).toBe(13); expect(s.str).toBe(17);
    expect(maxHp(fighter)).toBe(10 + 3 + 4 * (6 + 3) + 5); // 54
    expect(armorClass(fighter).ac).toBe(16 + 2 + 1);
    const [sword, bow] = attacks(fighter);
    expect(sword!.bonus).toBe(3 + 3); expect(sword!.dmg).toBe('1к8+3');
    expect(bow!.bonus).toBe(1 + 3);
    expect(speed(fighter)).toBe(25);
    expect(problems(fighter)).toEqual({});
    expect(allSkills(fighter)).toEqual(expect.arrayContaining(['Проницательность', 'Религия', 'Атлетика']));
    expect(features(fighter).some((f) => f.startsWith('3 ур.: Воинский архетип: Чемпион'))).toBe(true);
  });
  it('монах и варвар без доспехов', () => {
    const monk = mk({ level: 6, cls: 'monk', race: 'human', base: { str: 10, dex: 15, con: 13, int: 8, wis: 14, cha: 12 } });
    expect(armorClass(monk).ac).toBe(10 + 3 + 2); // ЛОВ 16, МДР 15 у человека
    expect(speed(monk)).toBe(30 + 15);
    expect(attacks(monk)[0]!.dmg).toBe('1к6+3');
    const barb = mk({ level: 5, cls: 'barbarian', race: 'halforc', base: { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 } });
    expect(armorClass(barb).ac).toBe(10 + 2 + 2); expect(speed(barb)).toBe(40);
    expect(maxHp(barb)).toBe(12 + 2 + 4 * (7 + 2));
  });
  it('2024: волшебник-эльф, бонусы предыстории и подготовка', () => {
    const w = mk({ ed: '2024', level: 3, cls: 'wizard', race: 'elf', sub: 'high', bg: 'sage', bgMode: '21', bgPlus2: 'int', bgPlus1: 'con', base: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 } });
    expect(scores(w).int).toBe(17); expect(scores(w).con).toBe(14);
    const r = rule(w)!; expect(r.spells).toBe(10); expect(r.prepared).toBe(6); expect(r.cantrips).toBe(3); expect(r.maxLvl).toBe(2);
    expect(maxHp(w)).toBe(6 + 2 + 2 * (4 + 2));
  });
  it('таблицы магии', () => {
    const cl = (id: string) => CLASSES.find((c) => c.id === id)!;
    expect(spellRule(cl('paladin'), '2014', 1, 3)).toBeUndefined();
    expect(spellRule(cl('paladin'), '2024', 1, 3)!.spells).toBe(2);
    expect(slots(cl('warlock'), '2014', 11)).toEqual([0, 0, 0, 0, 3]);
    expect(spellRule(cl('warlock'), '2014', 17, 4)!.arcanum).toEqual([6, 7, 8, 9]);
    expect(spellRule(cl('cleric'), '2014', 5, 3)!.spells).toBe(8);
    expect(spellRule(cl('bard'), '2014', 10, 4)!.cantrips).toBe(4);
    expect(slots(cl('ranger'), '2014', 5)).toEqual([4, 2]);
  });
  it('итог переносится в лист клуба', () => {
    const db = [{ id: 'x:fb', ed: '2014', src: 'SRD 5.1', name: 'Fire Bolt', ru: 'Огненный снаряд', lvl: 0, school: 'evocation', time: '', range: '', v: 1, s: 1, dur: '', c: 0, r: 0, cls: ['sorcerer'], text: '' }] as SpellData[];
    const sh = toSheet({ ...fighter, cantrips: ['x:fb'] }, db);
    const blocks = sh.pages.flatMap((p) => p.blocks);
    const v = (l: string) => blocks.find((b) => b.label === l)?.value;
    expect(v('Имя персонажа')).toBe('Торин'); expect(v('Класс')).toBe('Воин'); expect(v('Уровень')).toBe('5');
    expect(v('Максимум хитов')).toBe('54'); expect(v('Класс доспеха')).toBe('19');
    const str = blocks.find((b) => b.label === 'Сила')!; expect(str.score).toBe('17'); expect(str.save?.checked).toBe(true);
    expect(str.items?.find((i) => i.name === 'Атлетика')?.checked).toBe(true);
    expect(sh.spells).toHaveLength(1); expect(sh.dnd?.classes?.[0]).toEqual({ id: 'fighter', level: 5 });
    expect(mod(17)).toBe(3);
  });
});
