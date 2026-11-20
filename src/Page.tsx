/** Страница A4 с блоками: в режиме «Макет» блоки двигаются и меняют размер пальцем. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { resizeEdge } from './layout';
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

type Drag = { edge: 'right' | 'bottom'; id: string; x: number; y: number; cx: number; cy: number };

/**
 * Страница из блоков.
 * Обычный режим: касание блока открывает окно заполнения, на самой странице ничего не печатается и не прыгает.
 * Редактор страницы (карандаш): касание выделяет блок, оранжевые ручки двигают общую границу с соседями.
 * Перетаскивать блоки нельзя совсем.
 */
export function LayoutPage({ page, pageIndex, sheet, scale, num }: { page: Page; pageIndex: number; sheet: Sheet; scale: number; num: number }) {
  const { editPage, selected, select, commit, setPage, fill } = useStore();
  const layout = editPage === page.id;
  const drag = useRef<Drag | null>(null);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const preview = (): Block[] => {
    const d = drag.current;
    if (!d) return page.blocks;
    const mm = d.edge === 'right' ? (d.cx - d.x) / scale : (d.cy - d.y) / scale;
    return resizeEdge(page.blocks, d.id, d.edge, Math.round(mm * 2) / 2);
  };
  const finish = () => {
    if (!drag.current) return;
    const next = preview();
    drag.current = null;
    if (next !== page.blocks) commit((s) => ({ ...s, pages: s.pages.map((pg) => (pg.id === page.id ? { ...pg, blocks: next } : pg)) }));
    rerender();
  };
  const start = (e: React.PointerEvent, b: Block, edge: 'right' | 'bottom') => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { edge, id: b.id, x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY };
    rerender();
  };
  const move = (e: React.PointerEvent) => { if (!drag.current || !e.isPrimary) return; drag.current.cx = e.clientX; drag.current.cy = e.clientY; rerender(); };
  // второй палец во время перетаскивания границы — отменяем, это масштаб
  useEffect(() => {
    const multi = (e: TouchEvent) => { if (e.touches.length > 1 && drag.current) { drag.current = null; rerender(); } };
    document.addEventListener('touchstart', multi, { passive: true });
    return () => document.removeEventListener('touchstart', multi);
  }, []);

  const tap = (b: Block) => {
    setPage(pageIndex);
    if (layout) { select(b.id); return; }
    if (b.type === 'emblem' || b.type === 'ornament') return;
    fill(b.id);
  };

  const blocks = preview();
  return (
    <div className={layout ? 'layout' : 'filling'} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { drag.current = null; rerender(); }}>
      <PageShell scale={scale} sheet={sheet} num={num}>
        <div className="absolute inset-0" onClick={() => layout && select(undefined)} />
        {blocks.map((b) => (
          <div key={b.id} data-label={b.label} className={`bw ${layout && selected === b.id ? 'sel' : ''}`}
            style={{ left: `calc(var(--u) * ${b.x})`, top: `calc(var(--u) * ${b.y})`, width: `calc(var(--u) * ${b.w})`, height: `calc(var(--u) * ${b.h})` }}
            onClick={() => tap(b)}>
            <BlockView b={b} sheet={sheet} fill={false} />
            {layout && selected === b.id && <>
              <div className="handle handle-r" onPointerDown={(e) => start(e, b, 'right')} />
              <div className="handle handle-b" onPointerDown={(e) => start(e, b, 'bottom')} />
            </>}
          </div>
        ))}
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
