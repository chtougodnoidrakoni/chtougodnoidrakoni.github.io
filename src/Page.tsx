/** Страница A4 с блоками: в режиме «Макет» блоки двигаются и меняют размер пальцем. */
import { useLayoutEffect, useRef, useState } from 'react';
import { BlockView, pt } from './blocks';
import { PAGE_H, PAGE_W, SCHOOLS, spellOf, type Block, type Page, type Sheet, type SpellData } from './model';
import { useStore } from './store';

const snap = (v: number) => Math.round(v * 2) / 2; // шаг 0,5 мм
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function Corners() {
  const c = (style: React.CSSProperties, rot: number) => (
    <svg className="corner" style={style} viewBox="0 0 20 20"><g transform={`rotate(${rot} 10 10)`} fill="none" stroke="currentColor" strokeWidth="1.1"><path d="M2 12 V2 H12" /><path d="M5 9 V5 H9" /><circle cx="2" cy="2" r="1.3" fill="currentColor" /></g></svg>
  );
  return <>{c({ left: 'calc(var(--u)*7.5)', top: 'calc(var(--u)*7.5)' }, 0)}{c({ right: 'calc(var(--u)*7.5)', top: 'calc(var(--u)*7.5)' }, 90)}{c({ right: 'calc(var(--u)*7.5)', bottom: 'calc(var(--u)*7.5)' }, 180)}{c({ left: 'calc(var(--u)*7.5)', bottom: 'calc(var(--u)*7.5)' }, 270)}</>;
}

export function PageShell({ scale, sheet, num, children }: { scale: number; sheet: Sheet; num: number; children: React.ReactNode }) {
  return (
    <div className={`page ${sheet.paper === 'parchment' ? 'parchment' : ''}`} style={{ ['--u' as string]: `${scale}px` }}>
      <div className="page-inner" />
      <div className="page-frame" /><Corners />
      {children}
      <div className="page-num">{num}</div>
    </div>
  );
}

export function LayoutPage({ page, pageIndex, sheet, scale, num }: { page: Page; pageIndex: number; sheet: Sheet; scale: number; num: number }) {
  const { mode, selected, select, commit, setPage } = useStore();
  const layout = mode === 'layout';
  const [drag, setDrag] = useState<{ id: string; kind: 'move' | 'resize'; sx: number; sy: number; b: Block; dx: number; dy: number } | null>(null);

  const start = (e: React.PointerEvent, b: Block, kind: 'move' | 'resize') => {
    if (!layout) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    select(b.id);
    setPage(pageIndex);
    setDrag({ id: b.id, kind, sx: e.clientX, sy: e.clientY, b, dx: 0, dy: 0 });
  };
  const move = (e: React.PointerEvent) => { if (drag) setDrag({ ...drag, dx: (e.clientX - drag.sx) / scale, dy: (e.clientY - drag.sy) / scale }); };
  const end = () => {
    if (!drag) return;
    const g = geom(drag.b, drag);
    if (Math.abs(drag.dx) > 0.2 || Math.abs(drag.dy) > 0.2) {
      commit((s) => ({ ...s, pages: s.pages.map((p) => (p.id === page.id ? { ...p, blocks: p.blocks.map((x) => (x.id === drag.id ? { ...x, ...g } : x)) } : p)) }));
    }
    setDrag(null);
  };
  const geom = (b: Block, d = drag) => {
    if (!d || d.id !== b.id) return { x: b.x, y: b.y, w: b.w, h: b.h };
    if (d.kind === 'move') return { x: clamp(snap(b.x + d.dx), 0, PAGE_W - b.w), y: clamp(snap(b.y + d.dy), 0, PAGE_H - b.h), w: b.w, h: b.h };
    return { x: b.x, y: b.y, w: clamp(snap(b.w + d.dx), 6, PAGE_W - b.x), h: clamp(snap(b.h + d.dy), 4, PAGE_H - b.y) };
  };

  return (
    <div className={layout ? 'layout' : ''} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onClick={(e) => { if (layout && e.target === e.currentTarget) select(undefined); }}>
      <PageShell scale={scale} sheet={sheet} num={num}>
        <div className="absolute inset-0" onPointerDown={() => layout && select(undefined)} />
        {page.blocks.map((b) => {
          const g = geom(b);
          return (
            <div key={b.id} className={`bw ${selected === b.id ? 'sel' : ''}`} style={{ left: `calc(var(--u) * ${g.x})`, top: `calc(var(--u) * ${g.y})`, width: `calc(var(--u) * ${g.w})`, height: `calc(var(--u) * ${g.h})` }}
              onPointerDown={(e) => start(e, b, 'move')} onFocus={() => setPage(pageIndex)}>
              <BlockView b={b} sheet={sheet} fill={!layout} />
              {layout && selected === b.id && <div className="handle" onPointerDown={(e) => start(e, b, 'resize')} />}
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
