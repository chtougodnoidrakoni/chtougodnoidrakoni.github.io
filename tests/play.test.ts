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
