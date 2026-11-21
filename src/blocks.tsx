/** Отрисовка блоков листа. Все размеры — в миллиметрах через переменную --u (1 мм на печати). */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { abilityMod, autoItem, autoStat, calcSheet, signed, spellOf, type Block, type Sheet } from './model';
import { useStore } from './store';

export const u = (n: number) => `calc(var(--u) * ${n})`;
export const pt = (n: number, scale = 1) => `calc(var(--u) * ${(n * 0.3528 * scale).toFixed(3)})`;

function Label({ b, scale, children }: { b: Block; scale: number; children?: ReactNode }) {
  if (!b.label) return null;
  return <div className="blk-label" style={{ fontSize: pt(Math.max(5.5, b.fontSize * 0.72), scale) }}>{children ?? b.label}</div>;
}

/**
 * Поле с автозначением: пока игрок ничего не вписал, показывается посчитанное.
 * Вписал своё — остаётся его число. Стёр — снова считается само.
 */
function AutoInput({ value, auto, onChange, readOnly, className, style, inputMode }: { value?: string; auto: string; onChange: (v: string) => void; readOnly: boolean; className?: string; style?: CSSProperties; inputMode?: 'numeric' | 'text' }) {
  const [focus, setFocus] = useState(false);
  const own = !!value;
  return (
    <input className={`${className ?? ''} ${own ? 'own' : auto ? 'auto' : ''}`} style={style} inputMode={inputMode} readOnly={readOnly}
      value={focus ? value ?? '' : value || auto} placeholder={focus ? auto : ''}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onChange={(e) => onChange(e.target.value)} />
  );
}

export function BlockView({ b, sheet, fill }: { b: Block; sheet: Sheet; fill: boolean }) {
  const scale = sheet.fontScale;
  const { updateBlock, edit, spellMap } = useStore();
  const fs = pt(b.fontSize, scale);
  const set = (patch: Partial<Block>) => updateBlock(b.id, patch);
  const inputStyle: CSSProperties = { fontSize: fs };
  const frameCls = b.frame === 'frame' ? 'b-frame' : b.frame === 'line' ? 'b-line' : '';
  const calc = b.type === 'checklist' || b.type === 'stat' || b.type === 'abilityx' ? calcSheet(sheet) : undefined;

  switch (b.type) {
    case 'title':
      return (
        <div className={`blk ${frameCls} blk-title`}>
          <input className="inp font-display-sc" style={{ fontSize: fs }} value={b.value ?? ''} placeholder={b.label} readOnly={!fill} onChange={(e) => set({ value: e.target.value })} />
        </div>
      );
    case 'field':
      return (
        <div className={`blk ${frameCls} blk-field`}>
          <input className="inp" style={inputStyle} value={b.value ?? ''} readOnly={!fill} onChange={(e) => set({ value: e.target.value })} />
          <Label b={b} scale={scale} />
        </div>
      );
    case 'text':
      if (b.parts?.length) {
        const ts = b.textSize ?? b.fontSize;
        const lh = { fontSize: pt(ts, scale), lineHeight: 1.45, ['--lh' as string]: pt(ts * 1.45, scale) };
        return (
          <div className={`blk ${frameCls} blk-text`}>
            <Label b={b} scale={scale} />
            <div className="parts" style={{ gridTemplateColumns: `repeat(${b.parts.length}, minmax(0,1fr))` }}>
              {b.parts.map((title, i) => (
                <div key={i} className="part">
                  <div className="part-title" style={{ fontSize: pt(Math.max(6, b.fontSize * 0.85), scale) }}>{title}</div>
                  <textarea className={`inp area ${b.lined !== false ? 'lined' : ''}`} style={lh} value={b.values?.[i] ?? ''} readOnly={!fill}
                    onChange={(e) => set({ values: b.parts!.map((_, j) => (j === i ? e.target.value : b.values?.[j] ?? '')) })} />
                </div>
              ))}
            </div>
          </div>
        );
      }
      return (
        <div className={`blk ${frameCls} blk-text`}>
          <Label b={b} scale={scale} />
          <textarea className={`inp area ${b.lined !== false ? 'lined' : ''}`} style={{ fontSize: pt(b.textSize ?? b.fontSize, scale), lineHeight: 1.45, ['--lh' as string]: pt((b.textSize ?? b.fontSize) * 1.45, scale) }} value={b.value ?? ''} readOnly={!fill} onChange={(e) => set({ value: e.target.value })} />
        </div>
      );
    case 'image':
      return (
        <div className={`blk ${frameCls} blk-image`}>
          {b.src ? <img src={b.src} alt="" className="w-full h-full object-cover" style={{ borderRadius: u(1.2) }} /> : <div className="blk-ph"><Label b={b} scale={scale} />{fill && <span className="no-print">нажмите, чтобы загрузить</span>}</div>}
          {fill && <input type="file" accept="image/*" className="absolute inset-0 opacity-0 no-print" onChange={async (e) => { const f = e.target.files?.[0]; if (f) set({ src: await downscale(f, 900) }); }} />}
        </div>
      );
    case 'ability': {
      const mod = b.mod || abilityMod(b.score ?? '');
      return (
        <div className={`blk ${frameCls} blk-ability`}>
          <Label b={b} scale={scale} />
          <input className="inp font-display-sc text-center abil-mod" style={{ fontSize: pt(b.fontSize * 2.1, scale) }} value={mod} placeholder="±" readOnly={!fill} onChange={(e) => set({ mod: e.target.value })} />
          <input className="inp text-center abil-score" inputMode="numeric" style={{ fontSize: fs }} value={b.score ?? ''} placeholder="10" readOnly={!fill} onChange={(e) => set({ score: e.target.value.replace(/[^\d]/g, '').slice(0, 2), mod: '' })} />
        </div>
      );
    }
    case 'abilityx': {
      const mod = b.mod || abilityMod(b.score ?? '');
      const row = (it: NonNullable<Block['save']>, bold = false) => {
        const a = autoItem(it, calc!.mods, calc!.prof);
        return (
          <div className={`abx-row ${bold ? 'abx-save' : ''}`}>
            <span className={`dot ${it.checked ? 'on' : ''}`} />
            <span className="abx-val">{it.value || (a === undefined ? '' : signed(a))}</span>
            <span className="abx-name">{bold ? 'Спасбросок' : it.name}</span>
          </div>
        );
      };
      return (
        <div className={`blk ${frameCls} blk-abx`} style={{ fontSize: fs }}>
          <Label b={b} scale={scale} />
          <div className="abx-top">
            <div className="abx-mod">{mod || '±'}</div>
            <div className="abx-score">{b.score || ''}</div>
            <div className="abx-cap abx-cap-mod">модификатор</div>
            <div className="abx-cap abx-cap-score">значение</div>
          </div>
          {b.save && row(b.save, true)}
          {!!b.items?.length && <div className="abx-skills">{b.items.map((it, i) => <div key={i}>{row(it)}</div>)}</div>}
        </div>
      );
    }
    case 'stat':
      return (
        <div className={`blk ${b.shape === 'shield' ? 'b-shield' : b.shape === 'circle' ? 'b-circle' : b.shape === 'medal' ? 'b-medal' : frameCls} blk-stat`}>
          <AutoInput className="inp font-display-sc text-center" style={{ fontSize: pt(b.fontSize * (b.shape === 'medal' ? 2.6 : 2.3), scale) }} value={b.value} auto={autoStat(b, calc!)} readOnly={!fill} onChange={(v) => set({ value: v })} />
          <Label b={b} scale={scale} />
        </div>
      );
    case 'checklist':
      return (
        <div className={`blk ${frameCls} blk-list`}>
          <Label b={b} scale={scale} />
          <div className="list-rows" style={{ fontSize: fs }}>
            {(b.items ?? []).map((it, i) => (
              <div key={i} className="list-row">
                <button className={`dot ${it.checked ? 'on' : ''}`} disabled={!fill} onClick={() => set({ items: b.items!.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)) })} />
                {(() => { const a = autoItem(it, calc!.mods, calc!.prof); return (
                  <AutoInput className="inp list-val" value={it.value} auto={a === undefined ? '' : signed(a)} readOnly={!fill} onChange={(v) => set({ items: b.items!.map((x, j) => (j === i ? { ...x, value: v } : x)) })} />
                ); })()}
                <span className="list-name">{it.name}{it.sub && <span className="list-sub"> ({it.sub})</span>}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case 'circles':
      return (
        <div className={`blk ${frameCls} blk-circles`}>
          <Label b={b} scale={scale} />
          <div className="circ-grid" style={{ fontSize: fs, gridTemplateColumns: `repeat(${Math.max(1, Math.min(b.rows?.length ?? 1, Math.floor(b.w / 36)))}, minmax(0,1fr))` }}>
            {(b.rows ?? []).map((r, i) => (
              <div key={i} className="circ-row">
                <span className="circ-name">{r.name}</span>
                <span className="circ-dots">{Array.from({ length: r.count }, (_, k) => (
                  <button key={k} disabled={!fill} className={`circ ${k < r.filled ? 'on' : ''}`} onClick={() => set({ rows: b.rows!.map((x, j) => (j === i ? { ...x, filled: k < x.filled ? k : k + 1 } : x)) })} />
                ))}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case 'table':
      return (
        <div className={`blk ${frameCls} blk-table`}>
          <Label b={b} scale={scale} />
          <div className="tbl-wrap"><table style={{ fontSize: fs }}>
            {b.widths?.length === b.columns?.length && <colgroup>{b.widths!.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>}
            <thead><tr>{(b.columns ?? []).map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
            <tbody>{(b.cells ?? []).map((row, r) => (
              <tr key={r}>{(b.columns ?? []).map((_, c) => (
                <td key={c}><input className="inp" value={row[c] ?? ''} readOnly={!fill} onChange={(e) => set({ cells: b.cells!.map((rr, ri) => (ri === r ? (b.columns ?? []).map((_, ci) => (ci === c ? e.target.value : rr[ci] ?? '')) : rr)) })} /></td>
              ))}</tr>
            ))}</tbody>
          </table></div>
        </div>
      );
    case 'spells': {
      const list = sheet.spells.map((s) => ({ s, d: spellOf(s, spellMap) })).filter((x) => x.d && x.d.lvl >= (b.minLevel ?? 0) && x.d.lvl <= (b.maxLevel ?? 9))
        .sort((a, z) => a.d!.lvl - z.d!.lvl || (a.d!.ru ?? a.d!.name).localeCompare(z.d!.ru ?? z.d!.name));
      return (
        <div className={`blk ${frameCls} blk-spells`}>
          <Label b={b} scale={scale} />
          {fill && <button className="no-print add-spell" onClick={() => useStore.setState({ picker: { min: b.minLevel ?? 0, max: b.maxLevel ?? 9 } } as never)}>+ добавить</button>}
          <table style={{ fontSize: fs }}>
            <thead><tr><th className="w-ck">✓</th><th>Название</th><th>Кр</th><th>Время</th><th>Дистанция</th><th>Комп.</th><th>К</th><th>Р</th></tr></thead>
            <tbody>
              {list.map(({ s, d }) => (
                <tr key={s.key}>
                  <td className="w-ck"><button className={`dot ${s.prepared ? 'on' : ''}`} disabled={!fill} onClick={() => edit((sh) => ({ ...sh, spells: sh.spells.map((x) => (x.key === s.key ? { ...x, prepared: !x.prepared } : x)) }))} /></td>
                  <td className="sp-name">{d!.ru ?? d!.name}</td><td>{d!.lvl || 'з'}</td><td>{shortTime(d!.rt ?? d!.time)}</td><td>{d!.rr ?? shortRange(d!.range)}</td>
                  <td>{[d!.v && 'В', d!.s && 'С', d!.m && 'М'].filter(Boolean).join(' ')}</td><td>{d!.c ? '●' : ''}</td><td>{d!.r ? '●' : ''}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, Math.floor((b.h - 14) / 5.2) - list.length) }, (_, i) => <tr key={`e${i}`} className="empty"><td className="w-ck"><span className="dot" /></td>{Array.from({ length: 7 }, (_, k) => <td key={k}>&nbsp;</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      );
    }
    case 'qr': {
      const url = b.src?.startsWith('icons/') ? `${import.meta.env.BASE_URL}${b.src}` : b.src;
      return (
        <div className={`blk ${frameCls} blk-qr`}>
          {url && <img src={url} alt={b.label} />}
          <div className="qr-cap" style={{ fontSize: pt(b.fontSize * 1.5, scale) }}>{b.label}</div>
        </div>
      );
    }
    case 'emblem':
      return <div className="blk blk-emblem"><img src={sheet.emblem ?? `${import.meta.env.BASE_URL}icons/club-emblem.png`} alt="" className="w-full h-full object-contain" /></div>;
    case 'ornament':
      return <div className="blk blk-ornament"><svg viewBox="0 0 200 10" preserveAspectRatio="none" className="w-full h-full"><path d="M0 5 H86 M114 5 H200" stroke="currentColor" strokeWidth="0.8" /><path d="M92 5 L100 1 L108 5 L100 9 Z" fill="none" stroke="currentColor" strokeWidth="0.8" /><circle cx="100" cy="5" r="1.4" fill="currentColor" /></svg></div>;
  }
}

export const shortTime = (t: string) => t.replace(/^Бонусное действие.*/, 'БД').replace(/^Действие.*/, 'Д').replace(/^Реакция.*/, 'Р').replace(/1 action/i, 'Д').replace(/1 bonus action/i, 'БД').replace(/1 reaction/i, 'Р').replace(/(\d+) minutes?/i, '$1 мин').replace(/(\d+) hours?/i, '$1 ч').replace(/Action/i, 'Д').replace(/Bonus Action/i, 'БД').replace(/Reaction.*/i, 'Р');
export const shortRange = (r: string) => ({ self: 'на себя', touch: 'касание', sight: 'видимость', unlimited: '∞', special: 'особая' } as Record<string, string>)[r] ?? r.replace(' ft', ' фт').replace(' mile', ' миля');

/** Уменьшает фото до разумного размера, чтобы лист не раздувался. */
export async function downscale(file: File, max: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}
