/** Игровой режим: что можно бросить с листа и как считать результат. Без React — чтобы легко тестировать. */
import { abilityMod, autoItem, autoStat, calcSheet, cocBase, keyOf, sheetSystem, type Block, type Sheet } from './model';
import { CPR_KEY } from './blocks';

export type RollKind = 'd20' | 'd100' | 'pool' | 'd10' | 'dice';
export interface Rollable { group: string; name: string; kind: RollKind; mod?: number; target?: number; pool?: number; dice?: string; dmg?: string; }
export interface RollResult { title: string; total: number; detail: string; verdict?: string; tone?: 'crit' | 'good' | 'mid' | 'bad' | 'fumble'; at: number }

const n = (s?: string) => { const m = (s ?? '').replace('−', '-').match(/[+-]?\d+/); return m ? parseInt(m[0], 10) : undefined; };
const all = (s: Sheet) => s.pages.flatMap((p) => p.blocks);
const ABL: Record<string, string> = { СИЛ: 'Сила', ЛВК: 'Ловкость', ТЕЛ: 'Телосложение', ИНТ: 'Интеллект', МДР: 'Мудрость', ХАР: 'Харизма' };

export function rollables(s: Sheet): Rollable[] {
  const sys = sheetSystem(s); const blocks = all(s); const c = calcSheet(s); const out: Rollable[] = [];
  if (sys === 'dnd') {
    for (const b of blocks.filter((x) => x.type === 'abilityx')) {
      const mod = n(b.mod || abilityMod(b.score ?? '')); if (mod === undefined) continue;
      out.push({ group: 'Проверки', name: b.label, kind: 'd20', mod });
      if (b.save) { const v = n(b.save.value) ?? autoItem(b.save, c.mods, c.prof); if (v !== undefined) out.push({ group: 'Спасброски', name: b.label, kind: 'd20', mod: v }); }
      for (const it of b.items ?? []) { const v = n(it.value) ?? autoItem(it, c.mods, c.prof); if (v !== undefined) out.push({ group: 'Навыки', name: it.name, kind: 'd20', mod: v }); }
    }
    const init = blocks.find((b) => keyOf(b) === 'init');
    if (init) { const v = n(init.value) ?? n(autoStat(init, c)); if (v !== undefined) out.unshift({ group: 'Бой', name: 'Инициатива', kind: 'd20', mod: v }); }
    const w = blocks.find((b) => b.type === 'table' && b.label === 'Оружие');
    if (w?.columns && w.cells) {
      const ci = (name: string) => w.columns!.findIndex((x) => x === name);
      const [iN, iD, iH, iB, iT] = ['Оружие', 'Урон', 'Бонус к попаданию', 'Бонус к урону', 'Вид урона'].map(ci);
      for (const r of w.cells) {
        const name = r[iN!]?.trim(); if (!name) continue;
        const hit = n(r[iH!]); const dice = (r[iD!] ?? '').trim(); const bonus = n(r[iB!]) ?? 0;
        out.push({ group: 'Бой', name, kind: 'd20', mod: hit ?? 0, dmg: dice ? `${dice}${bonus ? (bonus > 0 ? '+' : '') + bonus : ''}${r[iT!] ? ' ' + r[iT!] : ''}` : undefined });
      }
    }
    const sa = blocks.find((b) => b.label === 'Бонус атаки' && b.value);
    if (sa && n(sa.value) !== undefined) out.push({ group: 'Бой', name: 'Атака заклинанием', kind: 'd20', mod: n(sa.value) });
  }
  if (sys === 'coc') {
    for (const b of blocks.filter((x) => x.type === 'pctstat')) { const v = n(b.value); if (v !== undefined) out.push({ group: 'Характеристики', name: b.label.split(' · ')[0]!, kind: 'd100', target: v }); }
    const luck = blocks.find((b) => b.label === 'Удача' && n(b.value) !== undefined); if (luck) out.push({ group: 'Характеристики', name: 'Удача', kind: 'd100', target: n(luck.value) });
    const san = blocks.find((b) => b.label === 'Рассудок' && n(b.value) !== undefined); if (san) out.push({ group: 'Характеристики', name: 'Рассудок', kind: 'd100', target: n(san.value) });
    for (const b of blocks.filter((x) => x.type === 'pctlist')) for (const it of b.items ?? []) {
      if (!it.name || it.sub === '#') continue;
      const v = n(it.value) ?? cocBase(it.sub, c.vals); if (v !== undefined && v > 0) out.push({ group: 'Навыки', name: it.name, kind: 'd100', target: v });
    }
  }
  if (sys === 'bitd') {
    for (const b of blocks.filter((x) => x.type === 'circles' && ['Проницательность', 'Удаль', 'Решимость'].includes(x.label))) {
      out.push({ group: b.label, name: `Сопротивление: ${b.label}`, kind: 'pool', pool: (b.rows ?? []).filter((r) => r.name !== 'Опыт' && r.filled > 0).length });
      for (const r of b.rows ?? []) if (r.name !== 'Опыт') out.push({ group: b.label, name: r.name, kind: 'pool', pool: r.filled });
    }
    out.push({ group: 'Броски', name: 'Удача / фортуна', kind: 'pool', pool: 1 });
  }
  if (sys === 'cpr') {
    for (const b of blocks.filter((x) => x.type === 'stat' && x.key?.startsWith('cpr:') && /^cpr:[A-Z]+$/.test(x.key))) { const v = n(b.value); if (v !== undefined) out.push({ group: 'Характеристики', name: b.label, kind: 'd10', mod: v }); }
    for (const b of blocks.filter((x) => x.type === 'sumlist')) for (const it of b.items ?? []) {
      const lvl = n(it.value); const st = c.vals[`cpr:${CPR_KEY[it.sub as keyof typeof CPR_KEY] ?? ''}`];
      if (lvl !== undefined && st !== undefined) out.push({ group: 'Навыки', name: it.name, kind: 'd10', mod: lvl + st });
    }
  }
  return out;
}

const d = (s: number) => 1 + Math.floor(Math.random() * s);

/** «2к6+3», «1d8 + 2 рубящий», «3d6» → сумма */
export function rollDice(expr: string): { total: number; detail: string } | null {
  const m = expr.replace(/\s/g, '').toLowerCase().replace(/к/g, 'd').match(/^(\d*)d(\d+)([+-−]\d+)?/);
  if (!m) return null;
  const cnt = Math.min(50, parseInt(m[1] || '1', 10)), sides = parseInt(m[2]!, 10), add = m[3] ? parseInt(m[3].replace('−', '-'), 10) : 0;
  const rs = Array.from({ length: cnt }, () => d(sides));
  const total = rs.reduce((a, b) => a + b, 0) + add;
  return { total, detail: `${cnt}к${sides}: ${rs.join(' + ')}${add ? ` ${add > 0 ? '+' : '−'} ${Math.abs(add)}` : ''}` };
}

export type Edge = 'none' | 'adv' | 'dis';
export function doRoll(r: Rollable, edge: Edge = 'none', cocDice = 0): RollResult {
  const at = Date.now();
  if (r.kind === 'd20') {
    const a = d(20), b = d(20); const pick = edge === 'adv' ? Math.max(a, b) : edge === 'dis' ? Math.min(a, b) : a;
    const mod = r.mod ?? 0;
    const det = `${edge === 'none' ? `к20: ${a}` : `к20: ${a} и ${b} → ${pick}`}${mod ? ` ${mod > 0 ? '+' : '−'} ${Math.abs(mod)}` : ''}`;
    return { title: r.name, total: pick + mod, detail: det, at, verdict: pick === 20 ? 'Естественная 20!' : pick === 1 ? 'Естественная 1' : undefined, tone: pick === 20 ? 'crit' : pick === 1 ? 'fumble' : undefined };
  }
  if (r.kind === 'd100') {
    const ones = d(10) - 1; const tens = Array.from({ length: 1 + Math.abs(cocDice) }, () => d(10) - 1);
    const vals = tens.map((t) => (t === 0 && ones === 0 ? 100 : t * 10 + ones));
    const v = cocDice > 0 ? Math.min(...vals) : cocDice < 0 ? Math.max(...vals) : vals[0]!;
    const t = r.target ?? 0;
    const [verdict, tone]: [string, RollResult['tone']] = v === 1 ? ['Критический успех!', 'crit'] : (v === 100 || (t < 50 && v >= 96)) ? ['Катастрофический провал', 'fumble'] : v <= Math.floor(t / 5) ? ['Чрезвычайный успех', 'crit'] : v <= Math.floor(t / 2) ? ['Трудный успех', 'good'] : v <= t ? ['Обычный успех', 'good'] : ['Провал', 'bad'];
    return { title: `${r.name} (${t}%)`, total: v, detail: cocDice ? `десятки: ${tens.map((x) => x * 10).join(', ')}, единицы: ${ones} → ${v}` : `к100: ${v}`, verdict, tone, at };
  }
  if (r.kind === 'pool') {
    const zero = (r.pool ?? 0) <= 0; const cnt = zero ? 2 : Math.min(10, r.pool!);
    const rs = Array.from({ length: cnt }, () => d(6)); const best = zero ? Math.min(...rs) : Math.max(...rs);
    const crit = !zero && rs.filter((x) => x === 6).length >= 2;
    const [verdict, tone]: [string, RollResult['tone']] = crit ? ['Критический успех!', 'crit'] : best === 6 ? ['Полный успех', 'good'] : best >= 4 ? ['Частичный успех: с последствиями', 'mid'] : ['Провал', 'bad'];
    return { title: r.name, total: best, detail: `${zero ? '0 точек → 2к6, берём меньший' : `${cnt}к6`}: ${rs.join(', ')}`, verdict, tone, at };
  }
  if (r.kind === 'd10') {
    const a = d(10); let extra = 0, note = '';
    if (a === 10) { extra = d(10); note = ` · крит! +${extra}`; } else if (a === 1) { extra = -d(10); note = ` · провал! ${extra}`; }
    return { title: r.name, total: a + extra + (r.mod ?? 0), detail: `к10: ${a}${note} + ${r.mod ?? 0}`, verdict: a === 10 ? 'Критический успех' : a === 1 ? 'Критический провал' : undefined, tone: a === 10 ? 'crit' : a === 1 ? 'fumble' : undefined, at };
  }
  const x = rollDice(r.dice ?? '1d20')!;
  return { title: r.name, total: x.total, detail: x.detail, at };
}

/* ---------- отдых (D&D) ---------- */
const setBy = (s: Sheet, pred: (b: Block) => boolean, fn: (b: Block) => Block): Sheet => ({ ...s, pages: s.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (pred(b) ? fn(b) : b)) })) });

export const CONDITIONS: [string, string][] = [
  ['Ослеплён', 'Ничего не видит; атаки по нему с преимуществом, его атаки с помехой.'],
  ['Очарован', 'Не может атаковать очаровавшего; тот получает преимущество в общении с ним.'],
  ['Оглох', 'Ничего не слышит, проваливает проверки, где нужен слух.'],
  ['Испуган', 'Помеха на проверки и атаки, пока видит источник страха; не может к нему приблизиться.'],
  ['Схвачен', 'Скорость 0. Заканчивается, если схвативший недееспособен или их разнесли.'],
  ['Недееспособен', 'Не может совершать действия и реакции.'],
  ['Невидим', 'Его не видно; его атаки с преимуществом, атаки по нему с помехой.'],
  ['Парализован', 'Недееспособен, не двигается и не говорит; проваливает спасброски СИЛ и ЛВК; удар вплотную — крит.'],
  ['Окаменел', 'Превращён в камень, недееспособен, сопротивление всему урону.'],
  ['Отравлен', 'Помеха на броски атаки и проверки характеристик.'],
  ['Сбит с ног', 'Двигается ползком; его атаки с помехой; атаки вплотную по нему с преимуществом, издалека — с помехой.'],
  ['Опутан', 'Скорость 0; его атаки и спасброски ЛВК с помехой, атаки по нему с преимуществом.'],
  ['Ошеломлён', 'Недееспособен, едва говорит; проваливает спасброски СИЛ и ЛВК; атаки по нему с преимуществом.'],
  ['Без сознания', 'Недееспособен, роняет всё, падает; удар вплотную — крит.'],
  ['Истощение', 'Уровни 1–6: от помехи на проверки до смерти. Снимается долгим отдыхом по одному уровню.'],
  ['Концентрация', 'Поддерживает заклинание. Получил урон — спасбросок ТЕЛ (СЛ 10 или половина урона).'],
];
const resetCharges = (s: Sheet, kinds: ('short' | 'long')[]): Sheet => (s.play?.charges ? { ...s, play: { ...s.play, charges: s.play.charges.map((c) => (kinds.includes(c.reset) ? { ...c, used: 0 } : c)) } } : s);
export const shortRest = (s: Sheet) => resetCharges(s, ['short']);

export function longRest(s: Sheet): Sheet {
  s = resetCharges(s, ['short', 'long']);
  const max = all(s).find((b) => b.label === 'Максимум хитов')?.value;
  let r = s;
  if (max) r = setBy(r, (b) => b.label === 'Текущие хиты', (b) => ({ ...b, value: max }));
  r = setBy(r, (b) => b.label === 'Временные хиты', (b) => ({ ...b, value: '' }));
  r = setBy(r, (b) => b.type === 'circles' && (b.label === 'Спасброски от смерти' || /ячейк/i.test(b.label)), (b) => ({ ...b, rows: (b.rows ?? []).map((x) => ({ ...x, filled: 0 })) }));
  return r;
}
/** Короткий отдых: бросок одной кости хитов + модификатор ТЕЛ, лечит до максимума. */
export function hitDie(s: Sheet): { sheet: Sheet; text: string } | null {
  const blocks = all(s); const c = calcSheet(s);
  const hd = blocks.find((b) => b.label === 'Кости хитов')?.value ?? '';
  const m = hd.toLowerCase().replace(/к/g, 'd').match(/d(\d+)/); if (!m) return null;
  const sides = parseInt(m[1]!, 10); const roll = d(sides); const heal = Math.max(1, roll + (c.mods['ТЕЛ'] ?? 0));
  const max = n(blocks.find((b) => b.label === 'Максимум хитов')?.value); const cur = n(blocks.find((b) => b.label === 'Текущие хиты')?.value) ?? 0;
  const next = max !== undefined ? Math.min(max, cur + heal) : cur + heal;
  return { sheet: setBy(s, (b) => b.label === 'Текущие хиты', (b) => ({ ...b, value: String(next) })), text: `к${sides}: ${roll} ${signedS(c.mods['ТЕЛ'] ?? 0)} = +${heal} хитов → ${next}${max !== undefined ? ` из ${max}` : ''}` };
}
const signedS = (x: number) => (x >= 0 ? `+ ${x}` : `− ${-x}`);
export const ABL_NAMES = ABL;
