/** Панели: свойства блока, выбор заклинаний, своё заклинание, настройки листа, шаблоны страниц. */
import { useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Plus, Trash2, Copy, Search, Check } from 'lucide-react';
import { BLOCK_NAMES, FONT_SETS, THEMES, sheetFonts, sheetName, sheetTheme, SCHOOLS, makeBlock, uid, type Block, type BlockType, type Frame, type SpellData } from './model';
import { findFree, removeAndFill, setSize, split } from './layout';
import { Columns2, Rows2 } from 'lucide-react';
import { useStore } from './store';
import { downscale } from './blocks';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 no-print" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/55" onClick={onClose} />
          <motion.div className="absolute inset-x-0 bottom-0 max-h-[85vh] flex flex-col rounded-t-3xl bg-moss-dark border-t border-sand/50 safe-bottom max-w-xl mx-auto"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
            <div className="flex items-center px-5 pt-4 pb-2"><div className="flex-1 font-display-sc text-2xl text-sand-light">{title}</div><button onClick={onClose} className="w-10 h-10 grid place-items-center text-cream/70"><X /></button></div>
            <div className="overflow-y-auto px-5 pb-4">{children}</div>
            {footer && <div className="px-5 pt-2 border-t border-moss-light/50">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Btn = ({ children, onClick, tone = 'base', className, disabled }: { children: ReactNode; onClick?: () => void; tone?: 'base' | 'gold' | 'danger' | 'ghost'; className?: string; disabled?: boolean }) => (
  <button disabled={disabled} onClick={onClick} className={cx('h-11 px-4 rounded-xl inline-flex items-center justify-center gap-2 transition disabled:opacity-40',
    tone === 'gold' ? 'bg-gradient-to-b from-sand-light to-sand text-moss-deep font-semibold' : tone === 'danger' ? 'border border-red-400/60 text-red-300' : tone === 'ghost' ? 'text-cream/80' : 'bg-moss border border-moss-light text-cream', className)}>{children}</button>
);
export const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="block"><div className="text-xs text-cream/60 mb-1 px-1">{label}</div>{children}</label>;
export const TextIn = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx('w-full h-11 px-3 rounded-xl bg-moss-deep border border-moss-light text-cream outline-none focus:border-sand', p.className)} />;
function Num({ value, onChange, step = 1, min = 0, max = 300 }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <div className="flex items-center rounded-xl bg-moss-deep border border-moss-light">
      <button className="w-10 h-11 text-sand-light text-lg" onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}>−</button>
      <input inputMode="decimal" className="w-full bg-transparent text-center outline-none" value={value} onChange={(e) => { const v = parseFloat(e.target.value.replace(',', '.')); if (!Number.isNaN(v)) onChange(Math.min(max, Math.max(min, v))); }} />
      <button className="w-10 h-11 text-sand-light text-lg" onClick={() => onChange(Math.min(max, +(value + step).toFixed(1)))}>+</button>
    </div>
  );
}

export function Inspector() {
  const { sheet, selected, select, updateBlock, commit } = useStore();
  const page = sheet?.pages.find((p) => p.blocks.some((b) => b.id === selected));
  const b = page?.blocks.find((x) => x.id === selected);
  if (!b || !page || !sheet) return null;
  const set = (patch: Partial<Block>) => updateBlock(b.id, patch, true);
  const mutatePage = (fn: (blocks: Block[]) => Block[]) => commit((s) => ({ ...s, pages: s.pages.map((p) => (p.id === page.id ? { ...p, blocks: fn(p.blocks) } : p)) }));
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 no-print bg-moss-dark/97 border-t border-sand/50 safe-bottom max-h-[46vh] overflow-y-auto backdrop-blur">
      <div className="max-w-xl mx-auto px-4 pt-3 grid gap-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 font-display-sc text-xl text-sand-light">{BLOCK_NAMES[b.type]}</div>
          <button title="Копия" className="w-10 h-10 grid place-items-center" onClick={() => {
            const r = findFree(page.blocks, b.w, b.h);
            if (!r) { useStore.getState().say('На странице нет места для копии — разделите блок или уменьшите соседей'); return; }
            const c = { ...structuredClone(b), id: uid(), ...r }; mutatePage((bl) => [...bl, c]); select(c.id);
          }}><Copy size={19} /></button>
          <button title="Удалить" aria-label="Удалить блок" className="w-10 h-10 grid place-items-center text-red-300" onClick={() => { mutatePage((bl) => removeAndFill(bl, b.id)); select(undefined); useStore.getState().say('Блок удалён, соседи заняли его место. Вернуть — стрелка «отменить»'); }}><Trash2 size={19} /></button>
          <button className="w-10 h-10 grid place-items-center" onClick={() => select(undefined)}><X size={20} /></button>
        </div>
        {b.type !== 'emblem' && b.type !== 'ornament' && <Field label="Подпись"><TextIn value={b.label} onChange={(e) => set({ label: e.target.value })} /></Field>}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Размер шрифта, pt"><Num value={b.fontSize} step={0.5} min={4} max={40} onChange={(v) => set({ fontSize: v })} /></Field>
          <Field label="Рамка">
            <select value={b.type === 'stat' ? b.shape ?? 'box' : b.frame} onChange={(e) => (b.type === 'stat' ? set({ shape: e.target.value as Block['shape'] }) : set({ frame: e.target.value as Frame }))} className="w-full h-11 px-3 rounded-xl bg-moss-deep border border-moss-light">
              {b.type === 'stat' ? <><option value="box">Прямоугольник</option><option value="shield">Щит</option><option value="circle">Круг</option><option value="medal">Медальон</option></> : <><option value="frame">Рамка</option><option value="line">Линия снизу</option><option value="none">Без рамки</option></>}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['w', 'h'] as const).map((k) => <Field key={k} label={k === 'w' ? 'Ширина, мм (сосед справа подстроится)' : 'Высота, мм (сосед снизу подстроится)'}><Num value={b[k]} step={1} min={4} max={k === 'w' ? 186 : 273} onChange={(v) => { const next = setSize(page.blocks, b.id, k, v); if (next === page.blocks) useStore.getState().say('Дальше некуда: мешает другой блок или край листа'); else mutatePage(() => next); }} /></Field>)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['h', 'v'] as const).map((dir) => (
            <Btn key={dir} onClick={() => { const r = split(page.blocks, b.id, dir, (rect) => makeBlock(b.type === 'emblem' || b.type === 'ornament' ? 'text' : b.type, { ...rect, label: 'Новый блок', fontSize: b.fontSize, frame: b.frame })); if (!r.created) useStore.getState().say('Блок слишком маленький, чтобы делить'); else { mutatePage(() => r.blocks); select(r.created.id); } }}>
              {dir === 'h' ? <Columns2 size={18} /> : <Rows2 size={18} />}{dir === 'h' ? 'Разделить по ширине' : 'Разделить по высоте'}
            </Btn>
          ))}
        </div>
        {b.type === 'text' && (
          <Field label="Колонки внутри блока">
            <div className="grid grid-cols-3 gap-2">{[1, 2, 3].map((n) => (
              <Btn key={n} tone={(b.parts?.length || 1) === n ? 'gold' : 'base'} onClick={() => {
                if (n === 1) set({ parts: undefined, value: [b.value, ...(b.values ?? [])].filter(Boolean).join('\n\n'), values: undefined });
                else { const parts = Array.from({ length: n }, (_, i) => b.parts?.[i] ?? `Колонка ${i + 1}`); const values = Array.from({ length: n }, (_, i) => b.values?.[i] ?? (i === 0 && !b.parts ? b.value ?? '' : '')); set({ parts, values, value: '' }); }
              }}>{n}</Btn>
            ))}</div>
          </Field>
        )}
        {b.type === 'text' && b.parts && b.parts.length > 1 && (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${b.parts.length}, minmax(0,1fr))` }}>
            {b.parts.map((t, i) => <Field key={i} label={`Заголовок ${i + 1}`}><TextIn value={t} onChange={(e) => set({ parts: b.parts!.map((x, j) => (j === i ? e.target.value : x)) })} /></Field>)}
          </div>
        )}
        {b.type === 'text' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b.lined !== false} onChange={(e) => set({ lined: e.target.checked })} className="w-5 h-5 accent-[#aa9173]" />Линейки для письма от руки</label>}
        {b.type === 'checklist' && <ListEditor items={(b.items ?? []).map((i) => [i.name, i.sub ?? ''])} cols={['Пункт', 'Пометка']} onChange={(rows) => set({ items: rows.map(([name, sub], i) => ({ ...(b.items?.[i] ?? {}), name: name ?? '', sub: sub || undefined })) })} />}
        {b.type === 'circles' && <ListEditor items={(b.rows ?? []).map((r) => [r.name, String(r.count)])} cols={['Название', 'Кружков']} onChange={(rows) => set({ rows: rows.map(([name, c], i) => ({ name: name ?? '', count: Math.min(20, Math.max(1, parseInt(c ?? '1', 10) || 1)), filled: Math.min(b.rows?.[i]?.filled ?? 0, parseInt(c ?? '1', 10) || 1) })) })} />}
        {b.type === 'table' && (
          <>
            <Field label="Столбцы через запятую"><TextIn value={(b.columns ?? []).join(', ')} onChange={(e) => set({ columns: e.target.value.split(',').map((x) => x.trim()) })} /></Field>
            <Field label="Ширина столбцов в %, через запятую (пусто — поровну)"><TextIn inputMode="numeric" defaultValue={(b.widths ?? []).join(', ')} key={b.id + (b.columns?.length ?? 0)} onBlur={(e) => { const w = e.target.value.split(',').map((x) => parseFloat(x)).filter((x) => x > 0); set({ widths: w.length === (b.columns?.length ?? 0) ? w : undefined }); }} /></Field>
            <Field label="Строк"><Num value={b.cells?.length ?? 0} min={1} max={40} onChange={(v) => set({ cells: Array.from({ length: v }, (_, i) => b.cells?.[i] ?? (b.columns ?? []).map(() => '')) })} /></Field>
          </>
        )}
        {b.type === 'spells' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="С круга (0 — заговоры)"><Num value={b.minLevel ?? 0} min={0} max={9} onChange={(v) => set({ minLevel: v })} /></Field>
            <Field label="По круг"><Num value={b.maxLevel ?? 9} min={0} max={9} onChange={(v) => set({ maxLevel: v })} /></Field>
          </div>
        )}
        {b.type === 'image' && b.src && <Btn tone="danger" onClick={() => set({ src: undefined })}>Убрать картинку</Btn>}
        <div className="h-2" />
      </div>
    </div>
  );
}

function ListEditor({ items, cols, onChange }: { items: string[][]; cols: [string, string]; onChange: (rows: string[][]) => void }) {
  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-[1fr_6rem_2.5rem] gap-1.5 text-xs text-cream/60 px-1"><span>{cols[0]}</span><span>{cols[1]}</span><span /></div>
      {items.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_6rem_2.5rem] gap-1.5">
          <TextIn value={r[0]} onChange={(e) => onChange(items.map((x, j) => (j === i ? [e.target.value, x[1] ?? ''] : x)))} />
          <TextIn value={r[1]} onChange={(e) => onChange(items.map((x, j) => (j === i ? [x[0] ?? '', e.target.value] : x)))} />
          <button className="text-red-300" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 size={17} className="mx-auto" /></button>
        </div>
      ))}
      <Btn onClick={() => onChange([...items, ['Новый пункт', cols[1] === 'Кружков' ? '3' : '']])}><Plus size={17} />Добавить строку</Btn>
    </div>
  );
}

export function AddBlockPanel({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (t: BlockType) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Добавить блок">
      <div className="grid grid-cols-2 gap-2 pb-2">
        {(Object.keys(BLOCK_NAMES) as BlockType[]).map((t) => <Btn key={t} className="h-14 text-sm" onClick={() => { onAdd(t); onClose(); }}>{BLOCK_NAMES[t]}</Btn>)}
      </div>
    </Sheet>
  );
}

export function SpellPicker() {
  const { picker, spells, sheet, edit, say } = useStore();
  const [q, setQ] = useState('');
  const [ed, setEd] = useState<'2014' | '2024'>('2014');
  const [lvl, setLvl] = useState<number | 'all'>('all');
  const [cls, setCls] = useState('');
  const [custom, setCustom] = useState(false);
  const chosen = new Set(sheet?.spells.map((s) => s.ref).filter(Boolean));
  const list = useMemo(() => {
    if (!picker) return [];
    const n = q.trim().toLowerCase();
    return spells.filter((s) => s.ed === ed && s.lvl >= picker.min && s.lvl <= picker.max && (lvl === 'all' || s.lvl === lvl) && (!cls || s.cls.includes(cls)) && (!n || s.name.toLowerCase().includes(n) || (s.ru ?? '').toLowerCase().includes(n)))
      .sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name)).slice(0, 200);
  }, [picker, spells, ed, lvl, cls, q]);
  const close = () => useStore.setState({ picker: undefined } as never);
  const toggle = (s: SpellData) => edit((sh) => (sh.spells.some((x) => x.ref === s.id) ? { ...sh, spells: sh.spells.filter((x) => x.ref !== s.id) } : { ...sh, spells: [...sh.spells, { key: uid(), ref: s.id, prepared: false }] }));
  const CLASSES = [['', 'Все классы'], ['bard', 'Бард'], ['cleric', 'Жрец'], ['druid', 'Друид'], ['paladin', 'Паладин'], ['ranger', 'Следопыт'], ['sorcerer', 'Чародей'], ['warlock', 'Колдун'], ['wizard', 'Волшебник']];
  return (
    <>
      <Sheet open={!!picker && !custom} onClose={close} title="Заклинания" footer={<div className="flex gap-2 pb-1"><Btn className="flex-1" onClick={() => setCustom(true)}><Plus size={17} />Своё заклинание</Btn><Btn tone="gold" className="flex-1" onClick={close}>Готово</Btn></div>}>
        <div className="grid gap-2 mb-3">
          <div className="grid grid-cols-2 gap-2">{(['2014', '2024'] as const).map((e) => <Btn key={e} tone={ed === e ? 'gold' : 'base'} onClick={() => setEd(e)}>{e === '2014' ? 'SRD 5.1 · 2014' : 'SRD 5.2 · 2024'}</Btn>)}</div>
          <div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/50" /><TextIn className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название (по-английски или по-русски)" /></div>
          <div className="grid grid-cols-2 gap-2">
            <select value={cls} onChange={(e) => setCls(e.target.value)} className="h-11 px-3 rounded-xl bg-moss-deep border border-moss-light">{CLASSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <select value={String(lvl)} onChange={(e) => setLvl(e.target.value === 'all' ? 'all' : +e.target.value)} className="h-11 px-3 rounded-xl bg-moss-deep border border-moss-light">
              <option value="all">Любой круг</option>{Array.from({ length: (picker?.max ?? 9) - (picker?.min ?? 0) + 1 }, (_, i) => (picker?.min ?? 0) + i).map((l) => <option key={l} value={l}>{l === 0 ? 'Заговоры' : `${l} круг`}</option>)}
            </select>
          </div>
        </div>
        {!spells.length && <div className="text-sm text-cream/60 py-6 text-center">База заклинаний не загрузилась. Проверьте интернет и откройте лист заново.</div>}
        <div className="grid gap-1.5">
          {list.map((s) => (
            <button key={s.id} onClick={() => { toggle(s); if (!chosen.has(s.id)) say(`Добавлено: ${s.ru ?? s.name}`); }} className={cx('flex items-center gap-3 text-left p-3 rounded-xl border', chosen.has(s.id) ? 'border-sand bg-sand/15' : 'border-moss-light bg-moss-deep/50')}>
              <span className={cx('w-6 h-6 rounded-lg border grid place-items-center shrink-0', chosen.has(s.id) ? 'bg-sand border-sand text-moss-deep' : 'border-moss-light')}>{chosen.has(s.id) && <Check size={15} />}</span>
              <span className="flex-1 min-w-0"><span className="block truncate">{s.ru ?? s.name}</span><span className="text-xs text-cream/55">{s.lvl === 0 ? 'заговор' : `${s.lvl} круг`} · {SCHOOLS[s.school] ?? s.school}{s.c ? ' · конц.' : ''}{s.r ? ' · ритуал' : ''}</span></span>
            </button>
          ))}
        </div>
      </Sheet>
      <CustomSpell open={!!picker && custom} onClose={() => setCustom(false)} />
    </>
  );
}

function CustomSpell({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { edit, say } = useStore();
  const empty: SpellData = { id: '', ed: '2014', src: 'Своё', name: '', lvl: 1, school: 'evocation', time: '1 действие', range: '60 фт', v: 1, s: 1, dur: 'Мгновенная', c: 0, r: 0, cls: [], text: '' };
  const [d, setD] = useState<SpellData>(empty);
  const set = (p: Partial<SpellData>) => setD({ ...d, ...p });
  return (
    <Sheet open={open} onClose={onClose} title="Своё заклинание" footer={<Btn tone="gold" className="w-full mb-1" disabled={!d.name.trim()} onClick={() => { edit((sh) => ({ ...sh, spells: [...sh.spells, { key: uid(), custom: { ...d, id: `custom:${uid()}`, name: d.name.trim() }, prepared: false }] })); say('Заклинание добавлено'); setD(empty); onClose(); }}>Добавить</Btn>}>
      <div className="grid gap-2 pb-2">
        <Field label="Название"><TextIn value={d.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Круг (0 — заговор)"><Num value={d.lvl} min={0} max={9} onChange={(v) => set({ lvl: v })} /></Field>
          <Field label="Школа"><select value={d.school} onChange={(e) => set({ school: e.target.value })} className="w-full h-11 px-3 rounded-xl bg-moss-deep border border-moss-light">{Object.entries(SCHOOLS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Время накладывания"><TextIn value={d.time} onChange={(e) => set({ time: e.target.value })} /></Field>
          <Field label="Дистанция"><TextIn value={d.range} onChange={(e) => set({ range: e.target.value })} /></Field>
          <Field label="Длительность"><TextIn value={d.dur} onChange={(e) => set({ dur: e.target.value })} /></Field>
          <Field label="Источник"><TextIn value={d.src} onChange={(e) => set({ src: e.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap gap-3 text-sm py-1">
          {([['v', 'Вербальный'], ['s', 'Соматический'], ['c', 'Концентрация'], ['r', 'Ритуал']] as const).map(([k, l]) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" className="w-5 h-5 accent-[#aa9173]" checked={!!d[k]} onChange={(e) => set({ [k]: e.target.checked ? 1 : 0 })} />{l}</label>)}
        </div>
        <Field label="Материальный компонент (если есть)"><TextIn value={d.m ?? ''} onChange={(e) => set({ m: e.target.value || undefined })} /></Field>
        <Field label="Описание"><textarea value={d.text} onChange={(e) => set({ text: e.target.value })} className="w-full min-h-36 p-3 rounded-xl bg-moss-deep border border-moss-light outline-none" /></Field>
      </div>
    </Sheet>
  );
}

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sheet, commit, say } = useStore();
  if (!sheet) return null;
  return (
    <Sheet open={open} onClose={onClose} title="Настройки листа">
      <div className="grid gap-3 pb-2">
        <Field label="Название листа (если пусто — имя героя)"><TextIn value={sheet.name === 'Новый персонаж' ? '' : sheet.name} placeholder={sheetName(sheet)} onChange={(e) => commit((s) => ({ ...s, name: e.target.value }))} /></Field>
        <Field label={`Общий размер шрифта: ${Math.round(sheet.fontScale * 100)}%`}><input type="range" min={0.7} max={1.5} step={0.05} value={sheet.fontScale} onChange={(e) => commit((s) => ({ ...s, fontScale: +e.target.value }))} className="w-full accent-[#aa9173]" /></Field>
        <Field label="Стиль листа">
          <div className="grid grid-cols-3 gap-2">{THEMES.map((t) => {
            const on = sheetTheme(sheet) === t.id;
            return (
              <button key={t.id} aria-label={`Стиль: ${t.name}`} onClick={() => commit((s) => ({ ...s, theme: t.id, fonts: t.fonts }))} className={`rounded-xl border p-2 text-left ${on ? 'border-sand bg-sand/15' : 'border-moss-light bg-moss-deep'}`}>
                <div className="aspect-[210/297] w-full bg-white rounded-sm p-1.5 flex flex-col gap-1" style={{ border: `2px ${t.id === 'chronicle' ? 'double' : 'solid'} ${t.ink}`, borderRadius: t.id === 'club' ? 6 : 1, clipPath: t.id === 'cyber' ? 'polygon(0 0, 85% 0, 100% 7%, 100% 100%, 15% 100%, 0 93%)' : undefined }}>
                  <div className="h-1.5 w-3/4" style={{ background: t.ink, opacity: .8 }} />
                  <div className="grid grid-cols-2 gap-1 flex-1">{[0, 1, 2, 3].map((k) => <div key={k} style={{ border: `1px solid ${t.ink}`, borderTop: t.id === 'cyber' ? `2px solid ${t.label}` : undefined, borderRadius: ['club', 'strict'].includes(t.id) ? 3 : 0, boxShadow: t.id === 'strict' ? 'none' : `inset 0 0 0 1.5px #fff, inset 0 0 0 2.2px ${t.accent}` }}><div className="h-0.5 w-1/2 m-1" style={{ background: t.label }} /></div>)}</div>
                </div>
                <div className={`fonts-${t.fonts} text-cream mt-1.5`} style={{ fontFamily: 'var(--f-display)', fontSize: 15, lineHeight: 1.1 }}>{t.name}</div>
                <div className="text-[11px] text-cream/55 leading-tight mt-0.5">{t.hint}</div>
              </button>
            );
          })}</div>
        </Field>
        <Field label="Шрифты листа">
          <div className="grid grid-cols-2 gap-2">{FONT_SETS.map((f) => (
            <button key={f.id} onClick={() => commit((s) => ({ ...s, fonts: f.id }))} className={`fonts-${f.id} rounded-xl border p-3 text-left ${sheetFonts(sheet) === f.id ? 'border-sand bg-sand/15' : 'border-moss-light bg-moss-deep'}`}>
              <div style={{ fontFamily: 'var(--f-display)', fontSize: 20, lineHeight: 1.1 }} className="text-cream">{f.name}</div>
              <div style={{ fontFamily: 'var(--f-body)', fontSize: 13 }} className="text-cream/60 mt-1">{f.hint}</div>
            </button>
          ))}</div>
        </Field>
        <Field label="Бумага">
          <div className="grid grid-cols-2 gap-2">{(['white', 'parchment'] as const).map((p) => <Btn key={p} tone={sheet.paper === p ? 'gold' : 'base'} onClick={() => commit((s) => ({ ...s, paper: p }))}>{p === 'white' ? 'Белая (для печати)' : 'Пергамент'}</Btn>)}</div>
        </Field>
        <Field label="Эмблема клуба">
          <div className="flex gap-2 items-center">
            <img src={sheet.emblem ?? `${import.meta.env.BASE_URL}icons/club-emblem.png`} alt="" className="w-14 h-14 object-contain rounded-full bg-moss-deep" />
            <label className="flex-1 h-11 rounded-xl bg-moss border border-moss-light grid place-items-center cursor-pointer">Загрузить свою<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const src = await downscale(f, 600); commit((s) => ({ ...s, emblem: src })); say('Эмблема обновлена на всех страницах'); } }} /></label>
            {sheet.emblem && <Btn tone="ghost" onClick={() => commit((s) => ({ ...s, emblem: undefined }))}>Сбросить</Btn>}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}
