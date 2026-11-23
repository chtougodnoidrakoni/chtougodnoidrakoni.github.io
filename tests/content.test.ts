import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { readPack, validate, setActive, classesFor, subsFor, usesAt, exportBuiltIn, type PackIn, type StoredPack, type FeatIn } from '../src/builder/content';
import { emptyBuild, maxHp, armorClass, features, armorProf, subSpells, rule, problems, scores, speed, allSkills, type Build } from '../src/builder/engine';
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

describe('библиотека контента: виды', () => {
  const racePack: PackIn = {
    format: 'dnd-content-pack', format_version: 1, ruleset: '5e-2014', pack_id: 'races_test', pack_name: 'Виды для проверки', pack_version: 1,
    races: [{ id: 'sylph', name: 'Сильф', name_en: 'Sylph', source: 'Тест', size: 'Medium', speed: 30, ability_score_increase: { dexterity: 2, wisdom: 1 }, languages: ['Общий', 'Ауран'],
      proficiencies: { skills: ['Акробатика'], weapons: ['Длинный меч'] },
      traits: [{ id: 'sylph_dv', name: 'Тёмное зрение', description: '60 футов.', effects: [{ type: 'darkvision', value: 60 }] }, { id: 'sylph_fast', name: 'Лёгкий шаг', description: '+5 футов.', effects: [{ type: 'speed', value: 5 }] }],
      subraces: [{ id: 'sylph_storm', name: 'Грозовой сильф', name_en: 'Storm Sylph', source: 'Тест', ability_score_increase: { constitution: 1 }, traits: [{ id: 'storm_t', name: 'Гроза', description: 'x', effects: [{ type: 'skill_proficiency', value: ['Выживание'] }] }] }] }],
  };
  it('шаблон с видом проходит проверку', () => { const r = validate(template); expect(r.errors).toEqual([]); expect(r.stats.races).toBe(1); expect(r.stats.subraces).toBe(1); });
  it('ошибки видов понятные', () => {
    const bad = JSON.parse(JSON.stringify(racePack)) as PackIn;
    const r0 = bad.races![0]!; (r0 as { size: string }).size = 'Huge'; r0.speed = 0; r0.ability_score_increase = { luck: 2 };
    r0.traits.push({ id: 'sylph_dv', name: 'Дубль', description: '' });
    r0.subraces!.push({ id: 'sylph_storm', name: 'Дубль', traits: undefined } as never);
    const e = validate(bad).errors.join('\n');
    expect(e).toMatch(/size должен быть/); expect(e).toMatch(/speed — целое/); expect(e).toMatch(/неизвестная характеристика «luck»/);
    expect(e).toMatch(/id черты «sylph_dv» повторяется/); expect(e).toMatch(/нет description/); expect(e).toMatch(/id подрасы «sylph_storm» повторяется/);
    expect(e).toMatch(/отсутствует поле traits/); expect(e).toMatch(/отсутствует поле name_en/);
    const noTraits = JSON.parse(JSON.stringify(racePack)) as PackIn; delete (noTraits.races![0] as Partial<typeof r0>).traits;
    expect(validate(noTraits).errors.join('\n')).toMatch(/В виде Сильф: отсутствует поле traits/);
  });
  it('вид из пакета применяется в сборке, повторный импорт не дублирует', () => {
    setActive([st(racePack), st(testClass)]);
    const b = mk({ ed: '2014', level: 3, cls: 'fighter', race: 'sylph', sub: 'sylph_storm', base, weapons: ['Длинный меч'] });
    const s = scores(b); expect(s.dex).toBe(16); expect(s.wis).toBe(16); expect(s.con).toBe(15);
    expect(speed(b)).toBe(35);
    expect(allSkills(b)).toEqual(expect.arrayContaining(['Акробатика', 'Выживание']));
    expect(validate(racePack, [st(racePack)]).mode).toBe('same');
    const both = { ...racePack, pack_id: 'mixed', classes: testClass.classes };
    const r = validate(both); expect(r.ok).toBe(true); expect(r.stats.classes).toBe(1); expect(r.stats.races).toBe(1);
  });
});

describe('библиотека контента: черты и предыстории', () => {
  const tpl2 = file('public/content/TEMPLATE_feats_backgrounds.txt');
  const fbPack: PackIn = {
    format: 'dnd-content-pack', format_version: 1, ruleset: '5e-2014', pack_id: 'fb_test', pack_name: 'Черты для проверки', pack_version: 1,
    feats: [
      { id: 'tough_test', name: 'Крепыш', name_en: 'Toughie', source: 'Тест', description: 'Хиты +2 за уровень.', prerequisite: null, prerequisites: [], effects: [{ type: 'hp_per_level', value: 2 }, { type: 'initiative', value: 1 }] },
      { id: 'strong_test', name: 'Силач', name_en: 'Strongman', source: 'Тест', description: 'x', prerequisite: 'Сила 15+', prerequisites: [{ type: 'ability', ability: 'strength', min: 15 }] },
      { id: 'half_test', name: 'Половинка', name_en: 'Half', source: 'Тест', description: 'x', asi_included: true, asi_choice: { abilities: ['strength', 'constitution'], value: 1 } },
      { id: 'caster_test', name: 'Маг', name_en: 'Mage', source: 'Тест', description: 'x', prerequisites: [{ type: 'spellcasting' }] },
    ],
    backgrounds: [{ id: 'sailor_test', name: 'Моряк', name_en: 'Sailor', source: 'Тест', description: 'Ходил по морям.', skill_proficiencies: ['Атлетика'], skill_choice: { choose: 1, from: ['Внимательность', 'Выживание'] },
      tool_proficiencies: ['навигационные инструменты'], languages: ['Один на выбор'], equipment: ['Верёвка', '10 зм'], feature: { name: 'Место на корабле', description: 'Бесплатный проезд.' },
      suggested_characteristics: { ideals: ['Свобода'] }, variants: [{ id: 'pirate_test', name: 'Пират', feature: { name: 'Дурная слава', description: 'Боятся.' } }] }],
  };
  it('шаблон черт и предысторий проходит проверку', () => { const r = validate(tpl2); expect(r.errors).toEqual([]); expect(r.stats.feats).toBe(3); expect(r.stats.backgrounds).toBe(1); });
  it('ошибки черт и предысторий', () => {
    const bad = JSON.parse(JSON.stringify(fbPack)) as PackIn;
    delete (bad.feats![0] as Partial<FeatIn>).name_en; bad.feats![1]!.prerequisites = [{ type: 'magic' } as never]; bad.feats![2]!.asi_choice = undefined;
    bad.backgrounds![0]!.variants![0]!.id = 'tough_test';
    const e = validate(bad).errors.join('\n');
    expect(e).toMatch(/отсутствует поле name_en/); expect(e).toMatch(/неизвестный тип предусловия/); expect(e).toMatch(/asi_included нужно asi_choice/); expect(e).toMatch(/повторяется/);
  });
  it('в сборке: предусловия, +1, эффекты, навыки предыстории', () => {
    setActive([st(fbPack)]);
    expect(validate(fbPack, [st(fbPack)]).mode).toBe('same');
    const b = mk({ ed: '2014', level: 8, cls: 'fighter', subclass: 'srd', race: 'human', bg: 'sailor_test', bgSkills: ['Выживание'], skills: ['Акробатика', 'Запугивание'],
      base: { str: 13, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, asi: { 4: { mode: 'feat', featId: 'half_test', featAb: 'str' }, 6: { mode: 'feat', featId: 'tough_test' }, 8: { mode: 'feat', featId: 'strong_test' } } });
    expect(scores(b).str).toBe(15); // 13 + 1 человек + 1 черта
    expect(problems(b).asi).toBeUndefined(); // на 8 уровне Сила уже 15
    const weak = { ...b, asi: { ...b.asi, 4: { mode: 'feat' as const, featId: 'half_test', featAb: 'con' as const } } };
    expect(problems(weak).asi?.join()).toMatch(/Силач.*нужно Сила 15\+ \(сейчас 14\)/);
    expect(problems({ ...b, asi: { ...b.asi, 8: { mode: 'feat', featId: 'caster_test' } } }).asi?.join()).toMatch(/накладывать заклинания/);
    expect(problems({ ...b, asi: { ...b.asi, 8: { mode: 'feat', featId: 'tough_test' } } }).asi?.join()).toMatch(/уже взята/);
    expect(maxHp(b)).toBe(10 + 2 + 7 * (6 + 2) + 2 * 8);
    expect(allSkills(b)).toEqual(expect.arrayContaining(['Атлетика', 'Выживание']));
    expect(problems({ ...b, bgSkills: [] }).bg?.join()).toMatch(/Навыки предыстории: выбрано 0 из 1/);
    const sh = toSheet(b, []);
    const v = (l: string) => sh.pages.flatMap((p) => p.blocks).find((x) => x.label === l);
    expect(v('Инициатива')?.value).toBe('+3');
    expect(v('Способности вида и предыстории')?.values?.[1]).toMatch(/Место на корабле\. Бесплатный проезд/);
    expect(v('Черты и дополнительные способности')?.values?.[0]).toMatch(/Половинка \(\+1 Сила\) \(4 ур\.\)/);
    expect(v('Владения')?.value).toMatch(/навигационные инструменты/);
  });
});
