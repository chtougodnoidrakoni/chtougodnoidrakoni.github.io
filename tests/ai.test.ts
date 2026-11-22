import { describe, expect, test } from 'vitest';
import { applyAi, extractJson, templateFor } from '../src/aiImport';
import { calcSheet, type SpellData } from '../src/model';

const answer = `Вот ваш персонаж!
**Имя:** Каэл
\`\`\`json
{
 "Имя персонажа": "Каэл Пепельный",
 "Уровень": 5, "Класс": "Паладин", "Вид": "Тифлинг",
 "Предыстория персонажа": "Рос в храме.\\nСбежал.",
 "Сила": { "значение": 16, "спасбросок": false, "навыки": ["Атлетика"] },
 "Харизма": { "значение": 16, "спасбросок": true, "навыки": ["Убеждение", "Запугивание"] },
 "Мудрость": { "значение": 10, "спасбросок": true, "навыки": [] },
 "Оружие": [["Длинный меч", "1к8", "+6", "+3", "рубящий"], ["Метательное копьё", "1к6", "+6", "+3", "колющий"]],
 "Монеты": [[0, 15, 0, 5, 0]],
 "Способности класса и подкласса": { "Класс": "Божественное чувство", "Подкласс": "Клятва преданности" },
 "Ячейки заклинаний": { "1 круг": 4, "2 круг": 2 },
 "все_заклинания": [ { "название": "Щит веры (Shield of Faith)", "круг": 1, "подготовлено": true }, { "название": "Нечто выдуманное", "круг": 2 } ],
}
\`\`\`
Удачи!`;

describe('автозаполнение ответом нейросети', () => {
  test('D&D: поля, характеристики, оружие, ячейки, заклинания', () => {
    const data = extractJson(answer)!;
    expect(data).toBeTruthy();
    const db = [{ id: 'x1', name: 'Shield of Faith', ru: 'Щит веры', lvl: 1 } as SpellData];
    const { sheet, filled } = applyAi(templateFor('dnd'), data, db);
    const all = sheet.pages.flatMap((p) => p.blocks);
    const by = (l: string) => all.find((b) => b.label === l)!;
    expect(filled).toBeGreaterThan(8);
    expect(by('Имя персонажа').value).toBe('Каэл Пепельный');
    expect(by('Класс').value).toBe('Паладин');
    expect(by('Предыстория персонажа').value).toBe('Рос в храме.\nСбежал.');
    expect(by('Сила').score).toBe('16');
    expect(by('Сила').items!.find((i) => i.name === 'Атлетика')!.checked).toBe(true);
    expect(by('Харизма').save!.checked).toBe(true);
    expect(by('Оружие').cells![1]![0]).toBe('Метательное копьё');
    expect(by('Монеты').cells![0]![1]).toBe('15');
    expect(by('Способности класса и подкласса').values).toEqual(['Божественное чувство', 'Клятва преданности']);
    expect(by('Ячейки заклинаний').rows![0]!.count).toBe(4);
    expect(sheet.spells.length).toBe(2);
    expect(sheet.spells[0]!.ref).toBe('x1');
    expect(sheet.spells[1]!.custom!.name).toBe('Нечто выдуманное');
    expect(calcSheet(sheet).prof).toBe(3);
  });
  test('Ктулху: характеристики и навыки', () => {
    const data = { 'СИЛ · сила': 50, 'ОБР · образование': 70, 'Имя сыщика': 'Артур', все_навыки: { 'Внимание': 60, 'Ближний бой': 45, 'Фотография': 50 } };
    const { sheet } = applyAi(templateFor('coc'), data, []);
    const all = sheet.pages.flatMap((p) => p.blocks);
    expect(all.find((b) => b.label === 'СИЛ · сила')!.value).toBe('50');
    const items = all.filter((b) => b.type === 'pctlist').flatMap((b) => b.items!);
    expect(items.find((i) => i.name === 'Внимание')!.value).toBe('60');
    expect(items.find((i) => i.name.startsWith('Ближний бой'))!.value).toBe('45');
    expect(items.find((i) => i.name === 'Фотография')!.value).toBe('50');
  });
});
