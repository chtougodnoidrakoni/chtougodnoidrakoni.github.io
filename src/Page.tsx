/** Страница A4 с блоками: в режиме «Макет» блоки двигаются и меняют размер пальцем. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { locked, resizeEdge } from './layout';
import { BlockView, pt } from './blocks';
import { PAGE_H, PAGE_W, SCHOOLS, spellOf, type Block, type Page, type Sheet, type SpellData } from './model';
import { useStore } from './store';


/** Восьмилучевая звезда, как на эмблеме клуба. */
const star = (cx: number, cy: number, r: number, k = 0.45) => Array.from({ length: 16 }, (_, i) => {
  const a = (Math.PI / 8) * i - Math.PI / 2, rr = i % 2 ? r * k : r;
  return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
}).join(' ');

/**
 * Украшения в стиле эмблемы: месяц и звёзды в углах рамки.
 * Всё внутри зоны печати (не ближе 7 мм к краю листа), иначе принтер срежет.
 */
function Sky({ theme }: { theme: string }) {
  if (theme === 'strict') return null;
  if (theme === 'chronicle') return <Flourishes />;
  return (
    <svg className="sky" viewBox="0 0 210 297" preserveAspectRatio="none">
      <path d="M10.6 7.3 a2.8 2.8 0 1 0 1 5.1 a2.3 2.3 0 1 1 -1 -5.1 z" />
      <polygon points={star(200.4, 9.4, 1.8)} /><polygon points={star(196.6, 8.4, 0.7)} />
      <polygon points={star(9.4, 287.6, 1.6)} /><polygon points={star(200.6, 287.6, 1.6)} />
      <polygon points={star(62, 288.4, 0.8)} /><polygon points={star(148, 288.4, 0.8)} />
      <polygon points={star(14.6, 8.6, 0.6)} />
    </svg>
  );
}

/** Завитки по углам и ромбы внизу — для стиля «Летопись». Тоже внутри зоны печати. */
function Flourishes() {
  const curl = 'M0 0 C4 0 6 1.5 6.5 4.5 C6.8 6.5 5.4 7.6 4.2 7 C3.2 6.5 3.4 5 4.5 4.9 M0 0 C0 4 1.5 6 4.5 6.5 C6.5 6.8 7.6 5.4 7 4.2 C6.5 3.2 5 3.4 4.9 4.5';
  const corners: [number, number, number, number][] = [[7.6, 7.6, 1, 1], [202.4, 7.6, -1, 1], [7.6, 289.4, 1, -1], [202.4, 289.4, -1, -1]];
  return (
    <svg className="sky flourish" viewBox="0 0 210 297" preserveAspectRatio="none">
      {corners.map(([x, y, sx, sy], i) => <path key={i} d={curl} transform={`translate(${x} ${y}) scale(${sx * 0.62} ${sy * 0.62})`} />)}
      {[60, 150].map((x) => <path key={x} className="fill" d={`M${x} 286.6 l1.1 1.2 l-1.1 1.2 l-1.1 -1.2 z`} />)}
    </svg>
  );
}

export function PageShell({ scale, sheet, num, children }: { scale: number; sheet: Sheet; num: number; children: React.ReactNode }) {
  return (
    <div className={`page fonts-${sheet.fonts ?? 'tale'} theme-${sheet.theme ?? 'club'} ${sheet.paper === 'parchment' ? 'parchment' : ''}`} style={{ ['--u' as string]: `${scale}px` }}>
      <div className="page-inner" />
      <div className="page-frame" /><Sky theme={sheet.theme ?? 'club'} />
      {children}
      <div className="page-foot">Что Угодно и Драконы • г. Астрахань</div>
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
    if (layout) { if (locked(b)) { useStore.getState().say(b.type === 'qr' ? 'QR-коды клуба не редактируются' : 'Этот блок закреплён: его место и размер менять нельзя'); return; } select(b.id); return; }
    if (b.type === 'emblem' || b.type === 'ornament' || b.type === 'qr') return;
    fill(b.id);
  };

  const blocks = preview();
  return (
    <div className={layout ? 'layout' : 'filling'} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { drag.current = null; rerender(); }}>
      <PageShell scale={scale} sheet={sheet} num={num}>
        <div className="absolute inset-0" onClick={() => layout && select(undefined)} />
        {blocks.map((b) => (
          <div key={b.id} data-label={b.label} className={`bw ${layout && selected === b.id ? 'sel' : ''} ${layout && locked(b) ? 'locked' : ''}`}
            style={{ left: `calc(var(--u) * ${b.x})`, top: `calc(var(--u) * ${b.y})`, width: `calc(var(--u) * ${b.w})`, height: `calc(var(--u) * ${b.h})` }}
            onClick={() => tap(b)}>
            <BlockView b={b} sheet={sheet} fill={false} />
            {!layout && b.type === 'text' && (
              <div className="fs-ctl no-print" onClick={(e) => e.stopPropagation()}>
                {([-0.5, 0.5] as const).map((d) => (
                  <button key={d} type="button" aria-label={`${d < 0 ? 'Меньше' : 'Больше'} шрифт: ${b.label}`}
                    onClick={(e) => { e.stopPropagation(); const v = Math.min(16, Math.max(5, Math.round((b.fontSize + d) * 2) / 2)); if (v !== b.fontSize) useStore.getState().updateBlock(b.id, { fontSize: v }, true); }}>{d < 0 ? '−' : '+'}</button>
                ))}
              </div>
            )}
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
  const comps = [d.v && 'В', d.s && 'С', d.m && `М (${d.rm ?? d.m})`].filter(Boolean).join(', ');
  const dur = d.rd ?? d.dur;
  const text = d.rtext ?? d.text;
  return (
    <div className="sp-card" style={{ fontSize: pt(8, scale) }}>
      <h3 style={{ fontSize: pt(13, scale) }}>{d.ru ?? d.name}</h3>
      {d.ru && <div className="sp-meta">{d.name}</div>}
      <div className="sp-meta">{lvl}{d.r ? ', ритуал' : ''}</div>
      <div className="sp-grid">
        <b>Время</b><span>{d.rt ?? d.time}</span>
        <b>Дистанция</b><span>{d.rr ?? d.range}</span>
        <b>Компоненты</b><span>{comps}</span>
        <b>Длительность</b><span>{d.c && !/^Концентрация/.test(dur) ? 'Концентрация, ' : ''}{dur}</span>
      </div>
      <div className="sp-text">{(text || '—').split(/\n{2,}/).map((p, i) => <p key={i}>{p.replace(/\*\*\*?|_/g, '')}</p>)}</div>
      <div className="sp-src">Источник: {d.src}{d.rtext ? ' (перевод клуба)' : ''}</div>
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
            <img src={sheet.emblem ?? `${import.meta.env.BASE_URL}icons/club-emblem.png`} alt="" className="absolute" style={{ right: 'calc(var(--u) * 12)', top: 'calc(var(--u) * 11)', width: 'calc(var(--u) * 16)', height: 'calc(var(--u) * 16)' }} />
            <div className="sb-cols">{cols.map((c, k) => <div key={k} className="sb-col">{c.map((d) => <SpellCard key={d.id} d={d} scale={sheet.fontScale} />)}</div>)}</div>
            {!list.length && <div className="absolute inset-0 grid place-items-center text-center no-print" style={{ color: 'var(--color-sand-dark)', fontSize: pt(11) }}>Добавьте заклинания на странице «Магия» —<br />здесь появятся их полные описания</div>}
          </PageShell>
        </div>
      ))}
    </>
  );
}

export function pageCount(page: Page) { return page.kind === 'spellbook' ? 1 : 1; }
