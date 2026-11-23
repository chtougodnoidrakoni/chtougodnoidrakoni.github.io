import { describe, expect, it } from 'vitest';
import { parseSpells, SPELL_TEMPLATE } from '../src/spellImport';

describe('разбор списка заклинаний', () => {
  it('шаблон даёт два заклинания со всеми полями', () => {
    const r = parseSpells(SPELL_TEMPLATE);
    expect(r).toHaveLength(2);
    const a = r[0].spell;
    expect(a.ru).toBe('Искристая пыль');
    expect(a.name).toBe('Glitter Dust');
    expect(a.lvl).toBe(1);
    expect(a.school).toBe('evocation');
    expect(a.v && a.s).toBe(1);
    expect(a.m).toBe('щепотка толчёного стекла');
    expect(a.c).toBe(1);
    expect(a.target).toMatch(/точка/);
    expect(a.area).toBe('куб 10 футов');
    expect(a.effect).toMatch(/Ловкости/);
    expect(a.cls).toEqual(['bard', 'wizard']);
    expect(a.text.split('\n\n')).toHaveLength(2);
    expect(r[1].spell.lvl).toBe(0);
  });
  it('без разделителей, с жирными ключами и бонусным действием', () => {
    const r = parseSpells(`1. **Название:** Огненный кнут\n**Уровень:** 2 круг\nДальность: 15 футов\nВремя накладывания: 1 бонусное действие\nКомпоненты: V, S\nДлительность: 1 минута\nКлассы: Колдун; Чародей\nОписание: Хлещет огнём.\nНазвание: Тихий шаг\nКруг: 1 (ритуал)\nШкола: Иллюзия\nОписание: Шаги не слышны.`, '2024');
    expect(r.map((x) => x.spell.ru ?? x.spell.name)).toEqual(['Огненный кнут', 'Тихий шаг']);
    expect(r[0].spell.time).toBe('1 бонусное действие');
    expect(r[0].spell.range).toBe('15 футов');
    expect(r[0].spell.cls).toEqual(['warlock', 'sorcerer']);
    expect(r[0].spell.ed).toBe('2024');
    expect(r[1].spell.r).toBe(1);
    expect(r[1].spell.school).toBe('illusion');
  });
  it('JSON массив', () => {
    const r = parseSpells(JSON.stringify([{ 'Название': 'Шип', 'Круг': 'заговор', 'Классы': ['Друид'], 'Описание': 'Укол.' }]));
    expect(r[0].spell.lvl).toBe(0);
    expect(r[0].spell.cls).toEqual(['druid']);
    expect(r[0].spell.id).toBe('user:2014:шип');
  });
  it('предупреждает о пустом круге и описании', () => {
    expect(parseSpells('Название: Пусто')[0].warn).toHaveLength(2);
  });
});
