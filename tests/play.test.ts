import { describe, expect, test } from 'vitest';
import { applyAi, templateFor } from '../src/aiImport';
import { doRoll, hitDie, longRest, rollables, rollDice } from '../src/play';

const dnd = () => applyAi(templateFor('dnd'), {
  'Уровень': 5, 'Сила': { значение: 16, спасбросок: true, навыки: ['Атлетика'] }, 'Ловкость': { значение: 14, спасбросок: false, навыки: [] },
  'Телосложение': { значение: 14 }, 'Максимум хитов': '44', 'Текущие хиты': '10', 'Временные хиты': '5', 'Кости хитов': '5к10',
  'Оружие': [['Длинный меч', '1к8', '+6', '+3', 'рубящий']],
}, []).sheet;

describe('игровой режим', () => {
  test('D&D: броски с листа', () => {
    const r = rollables(dnd());
    const by = (g: string, n: string) => r.find((x) => x.group === g && x.name === n)!;
    expect(by('Проверки', 'Сила').mod).toBe(3);
    expect(by('Спасброски', 'Сила').mod).toBe(6);
    expect(by('Навыки', 'Атлетика').mod).toBe(6);
    expect(by('Бой', 'Инициатива').mod).toBe(2);
    expect(by('Бой', 'Длинный меч').dmg).toBe('1к8+3 рубящий');
    for (let i = 0; i < 200; i++) { const x = doRoll(by('Навыки', 'Атлетика'), 'adv'); expect(x.total).toBeGreaterThanOrEqual(7); expect(x.total).toBeLessThanOrEqual(26); }
  });
  test('кубы урона', () => {
    for (let i = 0; i < 100; i++) { const x = rollDice('2к6+3')!; expect(x.total).toBeGreaterThanOrEqual(5); expect(x.total).toBeLessThanOrEqual(15); }
    expect(rollDice('1d8 + 2 рубящий')).toBeTruthy();
  });
  test('отдых', () => {
    const s = longRest(dnd()); const b = s.pages.flatMap((p) => p.blocks);
    expect(b.find((x) => x.label === 'Текущие хиты')!.value).toBe('44');
    expect(b.find((x) => x.label === 'Временные хиты')!.value).toBe('');
    const h = hitDie(dnd())!; const cur = parseInt(h.sheet.pages.flatMap((p) => p.blocks).find((x) => x.label === 'Текущие хиты')!.value!, 10);
    expect(cur).toBeGreaterThanOrEqual(11); expect(cur).toBeLessThanOrEqual(22);
  });
  test('Ктулху: уровни успеха', () => {
    const s = applyAi(templateFor('coc'), { 'ЛВК · ловкость': 60, все_навыки: { 'Внимание': 50 } }, []).sheet;
    const r = rollables(s);
    expect(r.find((x) => x.name === 'Внимание')!.target).toBe(50);
    expect(r.find((x) => x.name === 'Уклонение')!.target).toBe(30);
    const x = doRoll({ group: '', name: 't', kind: 'd100', target: 50 }); expect(x.verdict).toBeTruthy();
  });
});

import { applyLevel, findClass, plan, slotsFor, CLASSES } from '../src/levelup';
describe('новый уровень', () => {
  test('паладин 4 → 5', () => {
    const s = applyAi(templateFor('dnd'), { 'Класс': 'Паладин', 'Уровень': 4, 'Телосложение': { значение: 14 }, 'Максимум хитов': '36', 'Текущие хиты': '20' }, []).sheet;
    const cls = findClass(s)!; expect(cls.id).toBe('paladin');
    const p = plan(s, cls, 6); expect(p.hpGain).toBe(8); expect(p.feats).toContain('Дополнительная атака');
    const r = applyLevel(s, p, true); const b = r.pages.flatMap((x) => x.blocks);
    expect(b.find((x) => x.label === 'Уровень')!.value).toBe('5');
    expect(b.find((x) => x.label === 'Максимум хитов')!.value).toBe('44');
    expect(b.find((x) => x.label === 'Текущие хиты')!.value).toBe('28');
    expect(b.find((x) => x.label === 'Кости хитов')!.value).toBe('5к10');
    expect(b.find((x) => /ячейк/i.test(x.label))!.rows!.map((x) => x.count)).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);
  });
  test('таблицы ячеек', () => {
    const w = CLASSES.find((c) => c.id === 'wizard')!; expect(slotsFor(w, 5)).toEqual([4, 3, 2]);
    const k = CLASSES.find((c) => c.id === 'warlock')!; expect(slotsFor(k, 5)).toEqual([0, 0, 2]);
  });
});

import { calcSheet, cocPools } from '../src/model';
describe('Ктулху: очки навыков', () => {
  test('профессия + хранитель, личные отдельно', () => {
    let s = applyAi(templateFor('coc'), { 'ОБР · образование': 70, 'ИНТ · интеллект, идея': 60, 'ЛВК · ловкость': 50, 'СИЛ · сила': 65 }, []).sheet;
    s = { ...s, coc: { job: 'Частный детектив', bonus: 20 } };
    s = { ...s, pages: s.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => b.type !== 'pctlist' ? b : { ...b, items: b.items!.map((it) => it.name === 'Внимание' ? { ...it, value: '65', occ: true } : it.name === 'Слух' ? { ...it, value: '40' } : it) }) })) };
    const c = calcSheet(s);
    expect(cocPools(s, c.vals).prof).toBe(70 * 2 + 65 * 2 + 20);
    expect(c.vals['coc:profSpent']).toBe(40);
    expect(c.vals['coc:persSpent']).toBe(20);
    expect(c.vals['coc:persTotal']).toBe(120);
  });
});
