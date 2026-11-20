/**
 * Правила макета: блоки не двигаются как попало.
 * Можно поменять два блока местами или сдвинуть общую границу: один блок растёт, сосед уменьшается.
 * Расти в пустое место тоже можно, но не поверх других блоков и не за поля страницы.
 */
import { MARGIN, PAGE_H, PAGE_W, uid, type Block } from './model';

export const MIN_W = 8, MIN_H = 6, GAP = 2;
const EPS = 0.25;
const AREA = { x0: MARGIN, y0: MARGIN, x1: PAGE_W - MARGIN, y1: PAGE_H - MARGIN };

type Rect = Pick<Block, 'x' | 'y' | 'w' | 'h'>;
export const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;
const vSpan = (a: Rect, b: Rect) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
const hSpan = (a: Rect, b: Rect) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
const r1 = (v: number) => Math.round(v * 2) / 2;

/** Поменять местами два блока: каждый занимает место и размер другого. */
export function swap(blocks: Block[], a: string, b: string): Block[] {
  const A = blocks.find((x) => x.id === a), B = blocks.find((x) => x.id === b);
  if (!A || !B || a === b) return blocks;
  const ra = { x: A.x, y: A.y, w: A.w, h: A.h }, rb = { x: B.x, y: B.y, w: B.w, h: B.h };
  return blocks.map((x) => (x.id === a ? { ...x, ...rb } : x.id === b ? { ...x, ...ra } : x));
}

/** Соседи за правой (или нижней) границей блока — они делят с ним эту границу. */
export function neighbors(blocks: Block[], A: Block, edge: 'right' | 'bottom'): Block[] {
  return blocks.filter((B) => B.id !== A.id && (edge === 'right'
    ? Math.abs(B.x - (A.x + A.w)) <= GAP + 1.5 && vSpan(A, B) > 1
    : Math.abs(B.y - (A.y + A.h)) <= GAP + 1.5 && hSpan(A, B) > 1));
}

function apply(blocks: Block[], A: Block, nb: Block[], edge: 'right' | 'bottom', d: number): Block[] {
  const ids = new Set(nb.map((b) => b.id));
  return blocks.map((x) => {
    if (x.id === A.id) return edge === 'right' ? { ...x, w: r1(x.w + d) } : { ...x, h: r1(x.h + d) };
    if (ids.has(x.id)) return edge === 'right' ? { ...x, x: r1(x.x + d), w: r1(x.w - d) } : { ...x, y: r1(x.y + d), h: r1(x.h - d) };
    return x;
  });
}

export function valid(blocks: Block[], changed: Set<string>): boolean {
  for (const a of blocks) {
    if (!changed.has(a.id)) continue;
    if (a.w < MIN_W - EPS || a.h < MIN_H - EPS) return false;
    if (a.x < AREA.x0 - 3 - EPS || a.y < AREA.y0 - 3 - EPS || a.x + a.w > AREA.x1 + 3 + EPS || a.y + a.h > AREA.y1 + 3 + EPS) return false;
    for (const b of blocks) if (b.id !== a.id && overlap(a, b)) return false;
  }
  return true;
}

/**
 * Сдвинуть правую или нижнюю границу блока на d мм.
 * Соседи по этой границе сжимаются или растягиваются. Если целиком нельзя — двигаем насколько можно.
 */
export function resizeEdge(blocks: Block[], id: string, edge: 'right' | 'bottom', d: number): Block[] {
  const A = blocks.find((b) => b.id === id);
  if (!A || Math.abs(d) < 0.01) return blocks;
  const nb = neighbors(blocks, A, edge);
  const changed = new Set([A.id, ...nb.map((b) => b.id)]);
  // если исходный макет уже с наложениями (старый лист), не мешаем: проверяем только, что не стало хуже
  const ok = (bl: Block[]) => valid(bl, changed) || !valid(blocks, changed);
  const full = apply(blocks, A, nb, edge, d);
  if (ok(full)) return full;
  let lo = 0, hi = Math.abs(d);
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (ok(apply(blocks, A, nb, edge, Math.sign(d) * mid))) lo = mid; else hi = mid;
  }
  const step = Math.floor(lo * 2) / 2;
  return step > 0 ? apply(blocks, A, nb, edge, Math.sign(d) * step) : blocks;
}

/** Задать ширину или высоту — тем же механизмом, что и перетаскивание границы. */
export function setSize(blocks: Block[], id: string, key: 'w' | 'h', value: number): Block[] {
  const A = blocks.find((b) => b.id === id);
  if (!A) return blocks;
  return resizeEdge(blocks, id, key === 'w' ? 'right' : 'bottom', value - A[key]);
}

/** Разделить блок на два: новый блок занимает вторую половину. */
export function split(blocks: Block[], id: string, dir: 'h' | 'v', make: (r: Rect) => Block): { blocks: Block[]; created?: Block } {
  const A = blocks.find((b) => b.id === id);
  if (!A) return { blocks };
  if (dir === 'h') {
    const w1 = r1((A.w - GAP) / 2), w2 = r1(A.w - GAP - w1);
    if (w1 < MIN_W || w2 < MIN_W) return { blocks };
    const created = make({ x: r1(A.x + w1 + GAP), y: A.y, w: w2, h: A.h });
    return { blocks: [...blocks.map((b) => (b.id === id ? { ...b, w: w1 } : b)), created], created };
  }
  const h1 = r1((A.h - GAP) / 2), h2 = r1(A.h - GAP - h1);
  if (h1 < MIN_H || h2 < MIN_H) return { blocks };
  const created = make({ x: A.x, y: r1(A.y + h1 + GAP), w: A.w, h: h2 });
  return { blocks: [...blocks.map((b) => (b.id === id ? { ...b, h: h1 } : b)), created], created };
}

/** Свободное место под новый блок. Если ровно такого нет — пробуем меньше. */
export function findFree(blocks: Block[], w: number, h: number): Rect | undefined {
  for (const k of [1, 0.75, 0.5, 0.35]) {
    const ww = Math.max(MIN_W, r1(w * k)), hh = Math.max(MIN_H, r1(h * k));
    for (let y = AREA.y0; y + hh <= AREA.y1; y += 1) {
      for (let x = AREA.x0; x + ww <= AREA.x1; x += 1) {
        const r = { x, y, w: ww, h: hh };
        if (!blocks.some((b) => overlap({ x: r.x - GAP / 2, y: r.y - GAP / 2, w: r.w + GAP, h: r.h + GAP }, b))) return r;
      }
    }
  }
  return undefined;
}

/** Блок под точкой (мм) — цель для обмена местами. */
export function blockAt(blocks: Block[], x: number, y: number, except?: string): Block | undefined {
  return [...blocks].reverse().find((b) => b.id !== except && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
}

/**
 * Удалить блок, а освободившееся место отдать соседям.
 * Берём соседей с одной стороны, которые целиком помещаются по длине дыры, и растягиваем их.
 * Сторону выбираем ту, где соседи закрывают дыру полнее.
 */
export function removeAndFill(blocks: Block[], id: string): Block[] {
  const H = blocks.find((b) => b.id === id);
  if (!H) return blocks;
  const rest = blocks.filter((b) => b.id !== id);
  const near = (a: number, b: number) => Math.abs(a - b) <= GAP + 1.5;
  const inV = (B: Block) => B.y >= H.y - 1.5 && B.y + B.h <= H.y + H.h + 1.5;
  const inH = (B: Block) => B.x >= H.x - 1.5 && B.x + B.w <= H.x + H.w + 1.5;
  const sides: { pick: (B: Block) => boolean; grow: (B: Block) => Block; cover: (B: Block) => number; len: number }[] = [
    { pick: (B) => near(B.x + B.w + GAP, H.x) && inV(B), grow: (B) => ({ ...B, w: r1(H.x + H.w - B.x) }), cover: (B) => B.h, len: H.h },
    { pick: (B) => near(B.x, H.x + H.w + GAP) && inV(B), grow: (B) => ({ ...B, x: H.x, w: r1(B.x + B.w - H.x) }), cover: (B) => B.h, len: H.h },
    { pick: (B) => near(B.y + B.h + GAP, H.y) && inH(B), grow: (B) => ({ ...B, h: r1(H.y + H.h - B.y) }), cover: (B) => B.w, len: H.w },
    { pick: (B) => near(B.y, H.y + H.h + GAP) && inH(B), grow: (B) => ({ ...B, y: H.y, h: r1(B.y + B.h - H.y) }), cover: (B) => B.w, len: H.w },
  ];
  let best: { blocks: Block[]; score: number } | undefined;
  for (const side of sides) {
    const group = rest.filter(side.pick);
    if (!group.length) continue;
    const ids = new Set(group.map((b) => b.id));
    const next = rest.map((b) => (ids.has(b.id) ? side.grow(b) : b));
    if (!valid(next, ids)) continue;
    const score = group.reduce((a, b) => a + side.cover(b), 0) / side.len;
    if (!best || score > best.score + 0.01) best = { blocks: next, score };
  }
  return best?.blocks ?? rest;
}

export const newId = uid;
