/** Страница A4 с блоками: в режиме «Макет» блоки двигаются и меняют размер пальцем. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { blockAt, resizeEdge, swap } from './layout';
import { BlockView, pt } from './blocks';
import { PAGE_H, PAGE_W, SCHOOLS, spellOf, type Block, type Page, type Sheet, type SpellData } from './model';
import { useStore } from './store';


function Corners() {
  const c = (style: React.CSSProperties, rot: number) => (
    <svg className="corner" style={style} viewBox="0 0 20 20"><g transform={`rotate(${rot} 10 10)`} fill="none" stroke="currentColor" strokeWidth="1.1"><path d="M2 12 V2 H12" /><path d="M5 9 V5 H9" /><circle cx="2" cy="2" r="1.3" fill="currentColor" /></g></svg>
  );
  return <>{c({ left: 'calc(var(--u)*7.5)', top: 'calc(var(--u)*7.5)' }, 0)}{c({ right: 'calc(var(--u)*7.5)', top: 'calc(var(--u)*7.5)' }, 90)}{c({ right: 'calc(var(--u)*7.5)', bottom: 'calc(var(--u)*7.5)' }, 180)}{c({ left: 'calc(var(--u)*7.5)', bottom: 'calc(var(--u)*7.5)' }, 270)}</>;
}

export function PageShell({ scale, sheet, num, children }: { scale: number; sheet: Sheet; num: number; children: React.ReactNode }) {
  return (
    <div className={`page fonts-${sheet.fonts ?? 'tale'} ${sheet.paper === 'parchment' ? 'parchment' : ''}`} style={{ ['--u' as string]: `${scale}px` }}>
      <div className="page-inner" />
      <div className="page-frame" /><Corners />
      {children}
      <div className="page-num">{num}</div>
    </div>
  );
}

type Gesture =
  | { kind: 'pending'; id: string; x: number; y: number; timer?: ReturnType<typeof setTimeout>; mouse: boolean }
  | { kind: 'swap'; id: string; x: number; y: number; cx: number; cy: number }
  | { kind: 'right' | 'bottom'; id: string; x: number; y: number; cx: number; cy: number };

/**
 * Жесты макета. Касание выделяет блок. Только выделенный блок можно «поднять» долгим касанием (0,35 с),
 * и блок можно бросить на другой — они поменяются местами. Кружки на краях двигают общую границу.
 * Два пальца никогда не трогают блоки — это масштаб страницы.
 */
export function LayoutPage({ page, pageIndex, sheet, scale, num }: { page: Page; pageIndex: number; sheet: Sheet; scale: number; num: number }) {
  const { mode, selected, select, commit, setPage } = useStore();
  const layout = mode === 'layout';
  const g = useRef<Gesture | null>(null);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const host = useRef<HTMLDivElement>(null);

  const toMm = (cx: number, cy: number) => {
    const r = host.current!.querySelector('.page')!.getBoundingClientRect();
    return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
  };
  const cancel = () => { const cur = g.current; if (cur?.kind === 'pending' && cur.timer) clearTimeout(cur.timer); g.current = null; rerender(); };
  const preview = (): Block[] => {
    const cur = g.current;
    if (!cur || (cur.kind !== 'right' && cur.kind !== 'bottom')) return page.blocks;
    const d = cur.kind === 'right' ? (cur.cx - cur.x) / scale : (cur.cy - cur.y) / scale;
    return resizeEdge(page.blocks, cur.id, cur.kind, Math.round(d * 2) / 2);
  };
  const finish = () => {
    const cur = g.current;
    if (!cur) return;
    if (cur.kind === 'pending') { if (cur.timer) clearTimeout(cur.timer); select(cur.id); setPage(pageIndex); }
    else if (cur.kind === 'swap') {
      const p = toMm(cur.cx, cur.cy);
      const target = blockAt(page.blocks, p.x, p.y, cur.id);
      if (target) { commit((s) => ({ ...s, pages: s.pages.map((pg) => (pg.id === page.id ? { ...pg, blocks: swap(pg.blocks, cur.id, target.id) } : pg)) })); useStore.getState().say('Блоки поменялись местами'); }
      select(cur.id);
    } else {
      const next = preview();
      if (next !== page.blocks) commit((s) => ({ ...s, pages: s.pages.map((pg) => (pg.id === page.id ? { ...pg, blocks: next } : pg)) }));
    }
    g.current = null; rerender();
  };

  // касания отслеживаются на уровне документа: так второй палец сразу отменяет жест
  useEffect(() => {
    if (!layout) return;
    const move = (e: TouchEvent) => {
      const cur = g.current;
      if (!cur) return;
      if (e.touches.length > 1) { cancel(); return; }
      const t = e.touches[0]!;
      if (cur.kind === 'pending') {
        if (Math.hypot(t.clientX - cur.x, t.clientY - cur.y) > 8) cancel(); // это прокрутка
        return;
      }
      e.preventDefault();
      cur.cx = t.clientX; cur.cy = t.clientY; rerender();
    };
    const end = (e: TouchEvent) => { const c = g.current; if (e.touches.length === 0 && c && !(c.kind === 'pending' && c.mouse)) finish(); };
    const startMulti = (e: TouchEvent) => { if (e.touches.length > 1 && g.current) cancel(); };
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', cancel);
    document.addEventListener('touchstart', startMulti, { passive: true });
    return () => { document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); document.removeEventListener('touchcancel', cancel); document.removeEventListener('touchstart', startMulti); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, page, scale]);

  const touchStart = (e: React.TouchEvent, b: Block, kind: 'block' | 'right' | 'bottom') => {
    if (!layout) return;
    e.stopPropagation();
    if (e.touches.length > 1) { cancel(); return; }
    const t = e.touches[0]!;
    if (kind !== 'block') { g.current = { kind, id: b.id, x: t.clientX, y: t.clientY, cx: t.clientX, cy: t.clientY }; rerender(); return; }
    const pend: Gesture = { kind: 'pending', id: b.id, x: t.clientX, y: t.clientY, mouse: false };
    g.current = pend;
    // невыделенный блок от касания не двигается: первое касание только выделяет
    if (selected !== b.id) return;
    pend.timer = setTimeout(() => {
      if (g.current !== pend) return;
      g.current = { kind: 'swap', id: b.id, x: pend.x, y: pend.y, cx: pend.x, cy: pend.y };
      navigator.vibrate?.(15); rerender();
    }, 350);
    g.current = pend;
  };
  // мышь (компьютер): тянуть сразу, без долгого нажатия
  const mouseDown = (e: React.PointerEvent, b: Block, kind: 'block' | 'right' | 'bottom') => {
    if (!layout || e.pointerType !== 'mouse') return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    g.current = kind === 'block' ? { kind: 'pending', id: b.id, x: e.clientX, y: e.clientY, mouse: true } : { kind, id: b.id, x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY };
    rerender();
  };
  const mouseMove = (e: React.PointerEvent) => {
    const cur = g.current;
    if (!cur || e.pointerType !== 'mouse') return;
    if (cur.kind === 'pending') {
      if (selected === cur.id && Math.hypot(e.clientX - cur.x, e.clientY - cur.y) > 4) g.current = { kind: 'swap', id: cur.id, x: cur.x, y: cur.y, cx: e.clientX, cy: e.clientY };
    } else { cur.cx = e.clientX; cur.cy = e.clientY; }
    rerender();
  };
  const mouseUp = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') finish(); };

  const cur = g.current;
  const blocks = preview();
  const swapTarget = cur?.kind === 'swap' && host.current ? (() => { const p = toMm(cur.cx, cur.cy); return blockAt(page.blocks, p.x, p.y, cur.id)?.id; })() : undefined;

  return (
    <div ref={host} className={layout ? 'layout' : ''} onPointerMove={mouseMove} onPointerUp={mouseUp}>
      <PageShell scale={scale} sheet={sheet} num={num}>
        <div className="absolute inset-0" onClick={() => layout && select(undefined)} />
        {blocks.map((b) => {
          const lifted = cur?.kind === 'swap' && cur.id === b.id;
          return (
            <div key={b.id} className={`bw ${selected === b.id ? 'sel' : ''} ${lifted ? 'lifted' : ''} ${swapTarget === b.id ? 'target' : ''}`}
              style={{ left: `calc(var(--u) * ${b.x})`, top: `calc(var(--u) * ${b.y})`, width: `calc(var(--u) * ${b.w})`, height: `calc(var(--u) * ${b.h})`,
                ...(lifted ? { transform: `translate(${cur.cx - cur.x}px, ${cur.cy - cur.y}px)`, zIndex: 20 } : {}) }}
              onTouchStart={(e) => touchStart(e, b, 'block')} onPointerDown={(e) => mouseDown(e, b, 'block')} onFocus={() => setPage(pageIndex)}>
              <BlockView b={b} sheet={sheet} fill={!layout} />
              {layout && selected === b.id && !lifted && <>
                <div className="handle handle-r" onTouchStart={(e) => touchStart(e, b, 'right')} onPointerDown={(e) => mouseDown(e, b, 'right')} />
                <div className="handle handle-b" onTouchStart={(e) => touchStart(e, b, 'bottom')} onPointerDown={(e) => mouseDown(e, b, 'bottom')} />
              </>}
            </div>
          );
        })}
      </PageShell>
    </div>
  );
}

// ------------------------------------------------------------------ чарник

function SpellCard({ d, scale }: { d: SpellData; scale: number }) {
  const lvl = d.lvl === 0 ? `заговор, ${SCHOOLS[d.school]?.toLowerCase() ?? d.school}` : `${d.lvl} круг, ${SCHOOLS[d.school]?.toLowerCase() ?? d.school}`;
  const comps = [d.v && 'В', d.s && 'С', d.m && `М (${d.m})`].filter(Boolean).join(', ');
  return (
    <div className="sp-card" style={{ fontSize: pt(8, scale) }}>
      <h3 style={{ fontSize: pt(13, scale) }}>{d.ru ?? d.name}</h3>
      {d.ru && <div className="sp-meta">{d.name}</div>}
      <div className="sp-meta">{lvl}{d.r ? ', ритуал' : ''}</div>
      <div className="sp-grid">
        <b>Время</b><span>{d.time}</span>
        <b>Дистанция</b><span>{d.range}</span>
        <b>Компоненты</b><span>{comps}</span>
        <b>Длительность</b><span>{d.c ? 'Концентрация, ' : ''}{d.dur}</span>
      </div>
      <div className="sp-text">{(d.text || '—').split(/\n{2,}/).map((p, i) => <p key={i}>{p.replace(/\*\*\*?|_/g, '')}</p>)}</div>
      <div className="sp-src">Источник: {d.src}</div>
    </div>
  );
}

/** Карточки раскладываются по двум колонкам; страниц столько, сколько нужно. */
export function SpellbookPages({ page, sheet, scale, startNum }: { page: Page; sheet: Sheet; scale: number; startNum: number }) {
  const spellMap = useStore((s) => s.spellMap);
  const list = sheet.spells.map((s) => spellOf(s, spellMap)).filter((d): d is SpellData => !!d)
    .sort((a, b) => a.lvl - b.lvl || (a.ru ?? a.name).localeCompare(b.ru ?? b.name));
  const measure = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<SpellData[][][]>([]);
  const key = list.map((d) => d.id).join('|') + scale + sheet.fontScale;
  useLayoutEffect(() => {
    const el = measure.current;
    if (!el) return;
    const colH = (PAGE_H - 27 - 13) * scale;
    const gap = 3 * scale;
    const heights = [...el.children].map((c) => (c as HTMLElement).offsetHeight);
    const out: SpellData[][][] = [];
    let cur: SpellData[][] = [[], []], col = 0, used = 0;
    list.forEach((d, i) => {
      const h = Math.min(heights[i] ?? 0, colH);
      if (used > 0 && used + gap + h > colH) {
        col++; used = 0;
        if (col > 1) { out.push(cur); cur = [[], []]; col = 0; }
      }
      cur[col]!.push(d);
      used += (used ? gap : 0) + h;
    });
    if (cur[0]!.length) out.push(cur);
    setPages(out.length ? out : [[[], []]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const colW = ((PAGE_W - 24 - 5) / 2) * scale;
  return (
    <>
      <div ref={measure} aria-hidden style={{ position: 'absolute', left: -99999, top: 0, width: colW, visibility: 'hidden', ['--u' as string]: `${scale}px` }}>
        {list.map((d) => <div key={d.id} style={{ paddingBottom: 0 }}><SpellCard d={d} scale={sheet.fontScale} /></div>)}
      </div>
      {pages.map((cols, i) => (
        <div key={i} className="page-wrap py-3">
          <PageShell scale={scale} sheet={sheet} num={startNum + i}>
            <div className="absolute font-display-sc" style={{ left: 'calc(var(--u) * 12)', top: 'calc(var(--u) * 13)', fontSize: pt(18, sheet.fontScale), color: 'var(--color-moss)', fontWeight: 700 }}>{page.title}{pages.length > 1 ? ` · ${i + 1}` : ''}</div>
            <img src={sheet.emblem ?? `${import.meta.env.BASE_URL}icons/emblem.svg`} alt="" className="absolute" style={{ right: 'calc(var(--u) * 12)', top: 'calc(var(--u) * 11)', width: 'calc(var(--u) * 16)', height: 'calc(var(--u) * 16)' }} />
            <div className="sb-cols">{cols.map((c, k) => <div key={k} className="sb-col">{c.map((d) => <SpellCard key={d.id} d={d} scale={sheet.fontScale} />)}</div>)}</div>
            {!list.length && <div className="absolute inset-0 grid place-items-center text-center no-print" style={{ color: 'var(--color-sand-dark)', fontSize: pt(11) }}>Добавьте заклинания на странице «Магия» —<br />здесь появятся их полные описания</div>}
          </PageShell>
        </div>
      ))}
    </>
  );
}

export function pageCount(page: Page) { return page.kind === 'spellbook' ? 1 : 1; }
