import { describe, expect, it } from 'vitest';
import { clubTemplate, makeBlock, PAGE_TEMPLATES, type Block } from '../src/model';
import { findFree, overlap, removeAndFill, resizeEdge, setSize, split, swap, valid } from '../src/layout';

const b = (id: string, x: number, y: number, w: number, h: number): Block => ({ ...makeBlock('text'), id, x, y, w, h });
const noOverlaps = (bl: Block[]) => bl.every((a) => bl.every((c) => a === c || !overlap(a, c)));

describe('шаблоны без наложений', () => {
  it('все страницы шаблона клуба и шаблоны страниц', () => {
    for (const p of [...clubTemplate().pages, ...PAGE_TEMPLATES.map((t) => t.make())]) expect(noOverlaps(p.blocks), p.title).toBe(true);
  });
});

describe('граница между соседями', () => {
  const two = [b('a', 12, 30, 93, 40), b('c', 107, 30, 91, 40)];
  it('левый растёт — правый уменьшается на столько же', () => {
    const r = resizeEdge(two, 'a', 'right', 10);
    expect(r.find((x) => x.id === 'a')!.w).toBe(103);
    expect(r.find((x) => x.id === 'c')).toMatchObject({ x: 117, w: 81 });
    expect(noOverlaps(r)).toBe(true);
  });
  it('левый уменьшается — правый растёт', () => {
    const r = resizeEdge(two, 'a', 'right', -20);
    expect(r.find((x) => x.id === 'a')!.w).toBe(73);
    expect(r.find((x) => x.id === 'c')).toMatchObject({ x: 87, w: 111 });
  });
  it('сосед не может стать меньше минимума — граница останавливается', () => {
    const r = resizeEdge(two, 'a', 'right', 200);
    expect(r.find((x) => x.id === 'c')!.w).toBeGreaterThanOrEqual(8);
    expect(noOverlaps(r)).toBe(true);
  });
  it('нижняя граница: блок ниже сжимается', () => {
    const col = [b('t', 12, 30, 100, 40), b('u', 12, 72, 100, 40)];
    const r = resizeEdge(col, 't', 'bottom', 15);
    expect(r.find((x) => x.id === 't')!.h).toBe(55);
    expect(r.find((x) => x.id === 'u')).toMatchObject({ y: 87, h: 25 });
  });
  it('расти в пустоту можно, но не поверх чужого блока и не за поля', () => {
    const bl = [b('a', 12, 30, 50, 20), b('far', 100, 25, 50, 50)];
    const r = resizeEdge(bl, 'a', 'right', 200);
    expect(noOverlaps(r)).toBe(true);
    expect(r.find((x) => x.id === 'a')!.x + r.find((x) => x.id === 'a')!.w).toBeLessThanOrEqual(100);
    const alone = resizeEdge([b('a', 12, 30, 50, 20)], 'a', 'right', 500);
    expect(alone[0]!.x + alone[0]!.w).toBeLessThanOrEqual(201);
  });
  it('на реальной странице «Биография» любая граница не создаёт наложений', () => {
    const page = clubTemplate().pages[0]!;
    for (const blk of page.blocks) for (const d of [-30, -5, 5, 30]) for (const e of ['right', 'bottom'] as const) {
      expect(noOverlaps(resizeEdge(page.blocks, blk.id, e, d)), `${blk.label} ${e} ${d}`).toBe(true);
    }
  });
  it('точный размер из панели работает так же', () => {
    const r = setSize([b('a', 12, 30, 93, 40), b('c', 107, 30, 91, 40)], 'a', 'w', 80);
    expect(r.find((x) => x.id === 'c')).toMatchObject({ x: 94, w: 104 });
  });
});

describe('обмен местами, разделение, свободное место', () => {
  it('обмен меняет места и размеры, наложений нет', () => {
    const page = clubTemplate().pages[1]!;
    const blocks = page.blocks.map((x) => ({ ...x, fixed: false }));
    const [p, q] = [blocks[5]!, blocks[20]!];
    const r = swap(blocks, p.id, q.id);
    expect(r.find((x) => x.id === p.id)).toMatchObject({ x: q.x, y: q.y, w: q.w, h: q.h });
    expect(noOverlaps(r)).toBe(true);
  });
  it('разделение пополам по ширине и высоте', () => {
    const s1 = split([b('a', 12, 30, 100, 40)], 'a', 'h', (r) => b('n', r.x, r.y, r.w, r.h));
    expect(s1.blocks.map((x) => x.w)).toEqual([49, 49]);
    expect(noOverlaps(s1.blocks)).toBe(true);
    const s2 = split([b('a', 12, 30, 100, 40)], 'a', 'v', (r) => b('n', r.x, r.y, r.w, r.h));
    expect(s2.blocks.map((x) => x.h)).toEqual([19, 19]);
    expect(split([b('a', 12, 30, 10, 10)], 'a', 'h', (r) => b('n', r.x, r.y, r.w, r.h)).created).toBeUndefined();
  });
  it('свободное место находится и не пересекается с блоками', () => {
    const page = clubTemplate().pages[2]!;
    const bl = page.blocks.filter((x) => x.label !== 'Черты и дополнительные способности');
    const r = findFree(bl, 60, 30)!;
    expect(r).toBeDefined();
    expect(bl.some((x) => overlap(x, r))).toBe(false);
    expect(findFree(clubTemplate().pages[0]!.blocks, 150, 100)).toBeUndefined();
  });
  it('valid ловит наложение', () => {
    expect(valid([b('a', 12, 30, 50, 50), b('c', 40, 40, 50, 50)], new Set(['a']))).toBe(false);
  });
});

describe('удаление блока', () => {
  it('сосед справа занимает место удалённого', () => {
    const r = removeAndFill([b('a', 12, 30, 93, 40), b('c', 107, 30, 91, 40)], 'a');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ x: 12, w: 186 });
  });
  it('два соседа снизу вместе растут вверх', () => {
    const r = removeAndFill([b('top', 12, 30, 186, 40), b('l', 12, 72, 92, 30), b('r', 106, 72, 92, 30)], 'top');
    expect(r.map((x) => [x.y, x.h])).toEqual([[30, 72], [30, 72]]);
  });
  it('на всех страницах шаблона удаление любого блока не даёт наложений', () => {
    for (const p of clubTemplate().pages) for (const blk of p.blocks) expect(noOverlaps(removeAndFill(p.blocks, blk.id)), `${p.title}: ${blk.label}`).toBe(true);
  });
  it('на биографии место «Цели» занимает сосед', () => {
    const page = clubTemplate().pages[0]!;
    const goals = page.blocks.find((x) => x.label === 'Цели')!;
    const r = removeAndFill(page.blocks, goals.id);
    const area = (bl: Block[]) => bl.reduce((a, x) => a + x.w * x.h, 0);
    expect(area(r)).toBeGreaterThan(area(page.blocks) - goals.w * goals.h + 100);
  });
});

describe('таблица оружия', () => {
  it('старый порядок колонок переставляется вместе с текстом', async () => {
    const { migrateSheet, WEAPON_COLS } = await import('../src/model');
    const s = clubTemplate();
    const t = s.pages[1]!.blocks.find((x) => x.label === 'Оружие')!;
    t.columns = ['Оружие', 'Попадание', 'Бонус к урону', 'Урон', 'Вид урона']; t.widths = undefined;
    t.cells = [['Меч', '+5', '+3', '1d8', 'рубящий']];
    const m = migrateSheet(s).pages[1]!.blocks.find((x) => x.label === 'Оружие')!;
    expect(m.columns).toEqual(WEAPON_COLS);
    expect(m.cells![0]).toEqual(['Меч', '1d8', '+5', '+3', 'рубящий']);
    expect(m.widths).toEqual([30, 15, 15, 15, 25]);
  });
});

describe('разметка как в шаблоне', () => {
  it('переставляет блоки и сохраняет вписанное', async () => {
    const { relayoutFromTemplate } = await import('../src/model');
    const page = clubTemplate().pages[1]!;
    const hp = page.blocks.find((x) => x.label === 'Максимум хитов')!;
    const old = { ...page, blocks: page.blocks.map((x) => (x.id === hp.id ? { ...x, h: 30, value: '42' } : x)) };
    const r = relayoutFromTemplate(old, findFree)!;
    const n = r.page.blocks.find((x) => x.label === 'Максимум хитов')!;
    expect(n).toMatchObject({ id: hp.id, value: '42', h: 16 });
    expect(r.dropped).toBe(0);
    expect(noOverlaps(r.page.blocks)).toBe(true);
  });
});

describe('QR-коды заблокированы', () => {
  const page = () => clubTemplate().pages[0]!;
  const qr = (bl: Block[]) => bl.filter((x) => x.type === 'qr').map((x) => [x.x, x.y, x.w, x.h]);
  it('соседи не сжимают и не растягивают QR', () => {
    const p = page(); const before = qr(p.blocks);
    for (const blk of p.blocks) for (const d of [-40, 40]) for (const e of ['right', 'bottom'] as const) expect(qr(resizeEdge(p.blocks, blk.id, e, d))).toEqual(before);
  });
  it('удаление соседа не растягивает QR, сам QR не удаляется', () => {
    const p = page(); const before = qr(p.blocks);
    for (const blk of p.blocks) if (blk.type !== 'qr') expect(qr(removeAndFill(p.blocks, blk.id))).toEqual(before);
    const q = p.blocks.find((x) => x.type === 'qr')!;
    expect(removeAndFill(p.blocks, q.id)).toBe(p.blocks);
    expect(resizeEdge(p.blocks, q.id, 'right', 10)).toBe(p.blocks);
  });
});

describe('закреплённые блоки и обновление старых листов', () => {
  it('шапка биографии закреплена, текстовые блоки — нет', () => {
    const b = clubTemplate().pages[0]!.blocks;
    expect(b.find((x) => x.label === 'Портрет')!.fixed).toBe(true);
    expect(b.find((x) => x.label === 'Кампания')!.fixed).toBe(true);
    expect(b.find((x) => x.label === 'Внешность')!.fixed).toBeFalsy();
    const s = clubTemplate().pages[1]!.blocks;
    expect(s.find((x) => x.label === 'Оружие')!.fixed).toBe(true);
    expect(s.find((x) => x.label === 'Снаряжение')!.fixed).toBeFalsy();
  });
  it('старый лист: закрепление и удаление «Ресурсов» один раз', async () => {
    const { migrateLayout } = await import('../src/layout');
    const s = clubTemplate();
    const old: typeof s = { ...s, ver: undefined, pages: s.pages.map((p) => ({ ...p, blocks: p.blocks.map((x): Block => ({ ...x, fixed: undefined })) })) };
    old.pages[2]!.blocks.push({ ...makeBlock('circles'), label: 'Ресурсы', x: 12, y: 233, w: 186, h: 52 });
    old.pages[2]!.blocks = old.pages[2]!.blocks.map((x) => (x.label === 'Черты и дополнительные способности' ? { ...x, h: 56 } : x));
    const m = migrateLayout(old);
    expect(m.ver).toBe(2);
    expect(m.pages[2]!.blocks.some((x) => x.label === 'Ресурсы')).toBe(false);
    expect(m.pages[2]!.blocks.find((x) => x.label === 'Черты и дополнительные способности')!.h).toBe(111);
    expect(m.pages[0]!.blocks.find((x) => x.label === 'Портрет')!.fixed).toBe(true);
    expect(migrateLayout(m)).toBe(m);
  });
});

describe('карточки характеристик', () => {
  it('навыки и спасбросок считаются от значения внутри карточки', async () => {
    const { calcSheet, autoItem } = await import('../src/model');
    const s = clubTemplate();
    const wis = s.pages[1]!.blocks.find((x) => x.type === 'abilityx' && x.key === 'МДР')!;
    wis.score = '14'; wis.items = wis.items!.map((i) => (i.name === 'Внимательность' ? { ...i, checked: true } : i));
    s.pages[0]!.blocks.find((x) => x.key === 'level')!.value = '5';
    const c = calcSheet(s);
    expect(c.mods['МДР']).toBe(2);
    expect(autoItem(wis.items!.find((i) => i.name === 'Внимательность')!, c.mods, c.prof)).toBe(5);
    expect(autoItem(wis.save!, c.mods, c.prof)).toBe(2);
    expect(c.perception).toBe(5);
  });
  it('старая страница: значения и отметки переезжают в карточки', async () => {
    const { relayoutFromTemplate } = await import('../src/model');
    const old = { id: 'p', title: 'Характеристики', kind: 'layout' as const, blocks: [
      { ...makeBlock('ability'), id: 'str', label: 'Сила', score: '16', x: 12, y: 47, w: 30, h: 26 },
      { ...makeBlock('checklist'), id: 'sv', label: 'Спасброски', x: 44, y: 47, w: 60, h: 50, items: [{ name: 'Сила', sub: 'СИЛ', checked: true }] },
      { ...makeBlock('checklist'), id: 'sk', label: 'Навыки', x: 44, y: 99, w: 60, h: 100, items: [{ name: 'Атлетика', sub: 'СИЛ', checked: true, value: '+9' }] },
    ] };
    const r = relayoutFromTemplate(old, findFree)!;
    const str = r.page.blocks.find((x) => x.type === 'abilityx' && x.key === 'СИЛ')!;
    expect(str).toMatchObject({ id: 'str', score: '16' });
    expect(str.save!.checked).toBe(true);
    expect(str.items![0]).toMatchObject({ name: 'Атлетика', checked: true, value: '+9' });
    expect(r.page.blocks.some((x) => x.type === 'checklist' || x.type === 'ability')).toBe(false);
  });
});
