import { describe, expect, it } from 'vitest';
import { autoItem, autoStat, calcSheet, clubTemplate, oneshotTemplate, plusSign, slotRows, type Sheet } from '../src/model';
import { plainRich, renderRich } from '../src/rich';

const setField = (s: Sheet, label: string, value: string) => { for (const p of s.pages) for (const b of p.blocks) if (b.label === label && (b.type === 'field' || b.type === 'stat')) b.value = value; };
const setScore = (s: Sheet, key: string, score: string) => { for (const p of s.pages) for (const b of p.blocks) if (b.type === 'abilityx' && b.key === key) b.score = score; };
const block = (s: Sheet, label: string) => s.pages.flatMap((p) => p.blocks).find((b) => b.label === label)!;

describe('автоподсчёт листа D&D', () => {
  it('заклинательная характеристика, СЛ и бонус атаки по классу', () => {
    const s = clubTemplate(); setField(s, 'Класс', 'Волшебник'); setField(s, 'Уровень', '5'); setScore(s, 'ИНТ', '16');
    const c = calcSheet(s);
    expect(autoStat(block(s, 'Характеристика'), c)).toBe('Интеллект');
    expect(autoStat(block(s, 'СЛ спасброска'), c)).toBe('14');
    expect(autoStat(block(s, 'Бонус атаки'), c)).toBe('+6');
    expect(autoStat(block(s, 'Заклинательный класс'), c)).toBe('Волшебник');
    expect(autoStat(block(s, 'Кости хитов'), c)).toBe('5к6');
  });
  it('своя характеристика важнее класса', () => {
    const s = clubTemplate(); setField(s, 'Класс', 'Воин'); setField(s, 'Уровень', '3'); setField(s, 'Характеристика', 'ИНТ'); setScore(s, 'ИНТ', '14');
    expect(autoStat(block(s, 'СЛ спасброска'), calcSheet(s))).toBe('12');
  });
  it('ячейки по классу и уровню, лишние круги пустые, ручная правка не трогается', () => {
    const s = clubTemplate(); setField(s, 'Класс', 'Паладин'); setField(s, 'Уровень', '5');
    const b = block(s, 'Ячейки заклинаний');
    expect(slotRows(b, calcSheet(s)).map((r) => r.count)).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(slotRows({ ...b, manual: true }, calcSheet(s)).map((r) => r.count)[0]).toBe(4);
    setField(s, 'Класс', 'Колдун');
    expect(slotRows(b, calcSheet(s)).map((r) => r.count)).toEqual([0, 0, 2, 0, 0, 0, 0, 0, 0]);
    setField(s, 'Класс', '');
    expect(slotRows(b, calcSheet(s))).toBe(b.rows); // класс не указан — как в шаблоне
  });
  it('компетентность удваивает бонус мастерства', () => {
    const mods = { ЛВК: 3 };
    expect(autoItem({ name: 'Скрытность', sub: 'ЛВК', checked: true }, mods, 3)).toBe(6);
    expect(autoItem({ name: 'Скрытность', sub: 'ЛВК', checked: true, exp: true }, mods, 3)).toBe(9);
  });
  it('инициатива с плюсом', () => { expect(plusSign('2')).toBe('+2'); expect(plusSign('-1')).toBe('-1'); expect(plusSign('+3')).toBe('+3'); });
  it('лист для ваншота: первая страница — характеристики с именем и уровнем', () => {
    const s = oneshotTemplate();
    expect(s.pages[0]!.title).toBe('Характеристики');
    expect(s.pages.some((p) => p.title === 'Биография')).toBe(false);
    setField(s, 'Уровень', '4');
    expect(calcSheet(s).prof).toBe(2);
    expect(s.pages[0]!.blocks.find((b) => b.type === 'title')!.label).toBe('Имя персонажа');
  });
});

describe('оформление записей', () => {
  it('жирный, курсив, подчёркнутый и защита от html', () => {
    expect(renderRich('**Меч** и *щит* и __кольцо__ <b>')).toBe('<b>Меч</b> и <i>щит</i> и <u>кольцо</u> &lt;b&gt;');
    expect(plainRich('**a** *b* __c__')).toBe('a b c');
  });
});
