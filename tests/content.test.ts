import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { readPack, validate, setActive, classesFor, subsFor, usesAt, exportBuiltIn, type PackIn, type StoredPack } from '../src/builder/content';
import { emptyBuild, maxHp, armorClass, features, armorProf, subSpells, rule, problems, type Build } from '../src/builder/engine';
import { toSheet } from '../src/builder/toSheet';

const file = (p: string) => readPack(readFileSync(p, 'utf8')).data as PackIn;
const example = file('public/content/EXAMPLE_srd_subclasses.txt');
const template = file('public/content/TEMPLATE.txt');
const st = (pack: PackIn, origin: 'local' | 'club' = 'local'): StoredPack => ({ pack, enabled: true, importedAt: 1, origin });
const mk = (p: Partial<Build>): Build => ({ ...emptyBuild(), ...p });
const base = { str: 10, dex: 14, con: 14, int: 10, wis: 15, cha: 16 } as Build['base'];

// тестовый класс-заклинатель: только для проверки механики импорта, в базу сайта не попадает
const testClass: PackIn = {
  format: 'dnd-content-pack', format_version: 1, ruleset: '5e-2014', pack_id: 'test_pack', pack_name: 'Тестовый пакет', pack_version: 1,
  classes: [{ id: 'tester', name: 'Испытатель', hit_die: 8, saving_throws: ['constitution', 'intelligence'], skills: { choose: 2, from: 'any' }, subclass_level: 3,
    armor_proficiencies: ['light', 'shields'], weapon_proficiencies: { simple: true },
    spellcasting: { ability: 'intelligence', kind: 'prepared', progression: 'half_up', cantrips: Array(20).fill(2), prepared: { base: 'half_level_up', min: 1 }, spell_list: 'wizard' },
    features: [{ id: 't1', name: 'Искра', level: 1, description: 'Тест.', uses: { ability: 'intelligence', min: 1 }, recharge: 'long' }, { id: 't5', name: 'Рывок', level: 5, effects: [{ type: 'speed', value: 10 }] }],
    subclasses: [{ id: 'tsub', name: 'Путь проверки', features: [{ id: 'ts3', name: 'Проверка', level: 3, description: 'x', effects: [{ type: 'save_proficiency', value: ['wisdom'] }] }] } as never] }],
};

describe('библиотека контента: проверка файла', () => {
  it('шаблон и пример проходят проверку', () => {
    expect(validate(template).errors).toEqual([]);
    const r = validate(example); expect(r.ok).toBe(true); expect(r.stats.subclasses).toBe(4); expect(r.stats.features).toBeGreaterThan(18);
  });
  it('мусор и ошибки ловятся', () => {
    expect(readPack('просто текст').error).toBeTruthy();
    expect(readPack('{ "a": 1, }').error).toMatch(/JSON/);
    expect(validate({ format: 'x' }).ok).toBe(false);
    const bad = JSON.parse(JSON.stringify(testClass)) as PackIn;
    bad.classes![0]!.hit_die = 7; bad.classes![0]!.features.push({ id: 't1', name: 'Дубль', level: 25 });
    bad.subclasses = [{ id: 'orphan', class_id: 'nope', name: 'Сирота', features: [{ id: 'o1', name: 'x', level: 3 }] }, { id: 'loop', class_id: 'orphan', name: 'Петля', features: [{ id: 'o2', name: 'y', level: 3 }] }];
    const r = validate(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/hit_die/); expect(r.errors.join('\n')).toMatch(/повторяется/); expect(r.errors.join('\n')).toMatch(/от 1 до 20/);
    expect(r.errors.join('\n')).toMatch(/«nope» не найден/); expect(r.errors.join('\n')).toMatch(/циклическая/);
  });
  it('повторный импорт и версии', () => {
    expect(validate(example, [st(example)]).mode).toBe('same');
    const v2 = { ...example, pack_version: 2, subclasses: [...example.subclasses!.slice(0, 3)] };
    const r = validate(v2, [st(example)]); expect(r.mode).toBe('update'); expect(r.stats.newSubclasses).toEqual([]); expect(r.stats.updated.length).toBeGreaterThan(0);
    expect(validate({ ...example, pack_version: 0 } as PackIn).ok).toBe(false);
  });
  it('редакция: пакет 2014 не виден в 2024', () => {
    setActive([st(example)]);
    expect(subsFor('2014', 'fighter').map((s) => s.name)).toEqual(['Чемпион']);
    expect(subsFor('2024', 'fighter')).toEqual([]);
  });
  it('тысячи способностей проверяются быстро', () => {
    const big = JSON.parse(JSON.stringify(testClass)) as PackIn;
    big.classes![0]!.features = Array.from({ length: 3000 }, (_, i) => ({ id: `f${i}`, name: `Способность ${i}`, level: 1 + (i % 20), description: 'x' }));
    const t = performance.now(); const r = validate(big); expect(r.ok).toBe(true); expect(r.stats.features).toBe(3001); expect(performance.now() - t).toBeLessThan(500);
  });
  it('экспорт встроенных классов снова проходит проверку', () => { expect(validate(exportBuiltIn('2014')).ok).toBe(true); });
});

describe('библиотека контента: в сборке', () => {
  beforeEach(() => setActive([st(example, 'club'), st(testClass)]));
  it('подклассы SRD из пакета работают механически', () => {
    const life = mk({ level: 5, cls: 'cleric', subclass: 'srd_subclasses_2014:life', race: 'human', bg: 'acolyte', base });
    expect(armorProf(life).kinds.has('heavy')).toBe(true);
    expect(subSpells(life)).toEqual(['Bless', 'Cure Wounds', 'Lesser Restoration', 'Spiritual Weapon', 'Beacon of Hope', 'Revivify']);
    const champ = mk({ level: 7, cls: 'fighter', subclass: 'srd_subclasses_2014:champion', style: 'Защита (+1 к КД в доспехе)', base });
    const f = features(champ).join('\n'); expect(f).toMatch(/Улучшенный критический удар \(Чемпион\)/); expect(f).toMatch(/Выдающийся атлет/); expect(f).not.toMatch(/умение подкласса/);
    const sorc = mk({ level: 4, cls: 'sorcerer', subclass: 'srd_subclasses_2014:draconic', base });
    expect(maxHp(sorc)).toBe(6 + 2 + 3 * (4 + 2) + 4); expect(armorClass(sorc).ac).toBe(13 + 2);
  });
  it('новый класс из пакета: выбор, магия, подкласс, заряды', () => {
    expect(classesFor('2014').map((c) => c.name)).toContain('Испытатель');
    const t = mk({ level: 5, cls: 'tester', subclass: 'test_pack:tsub', race: 'human', bg: 'acolyte', base: { ...base, int: 15 }, skills: ['Магия', 'Анализ'] });
    const r = rule(t)!; expect(r.maxLvl).toBe(2); expect(r.spells).toBe(3 + 3); expect(r.cantrips).toBe(2);
    expect(problems(t).class).toBeUndefined();
    expect(features(t).join('\n')).toMatch(/3 ур\.: Специализация|3 ур\.: Подкласс: Путь проверки/);
    const sh = toSheet({ ...t, cantrips: [], spells: [] }, []);
    expect(sh.play?.charges?.[0]).toMatchObject({ name: 'Искра', max: 3, reset: 'long' });
    const wis = sh.pages.flatMap((p) => p.blocks).find((b) => b.label === 'Мудрость');
    expect(wis?.save?.checked).toBe(true);
    expect(usesAt({ by_level: { 3: 2, 7: 3 } }, 8, {} as never, 3)).toBe(3);
  });
  it('выключенный пакет пропадает из сборки, старые выборы не ломают расчёт', () => {
    setActive([{ ...st(testClass), enabled: false }]);
    expect(classesFor('2014').map((c) => c.id)).not.toContain('tester');
    const t = mk({ level: 5, cls: 'tester', base });
    expect(maxHp(t)).toBe(0); expect(problems(t).class).toEqual(['Выберите класс']);
  });
});
