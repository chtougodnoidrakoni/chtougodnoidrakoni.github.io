/**
 * Окно заполнения блока. Открывается касанием блока на странице.
 * Всё пишется здесь крупными полями, на странице ничего не прыгает. «Сохранить» переносит текст в лист.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Trash2, ImagePlus } from 'lucide-react';
import { useStore } from './store';
import { abilityMod, autoItem, autoStat, calcSheet, signed, spellOf, BLOCK_NAMES, type Block } from './model';
import { downscale } from './blocks';

const base = 'px-3 rounded-xl bg-moss-deep border border-moss-light text-cream outline-none focus:border-sand';
const box = `w-full ${base}`;
const In = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${box} h-12 ${p.className ?? ''}`} />;
const Area = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${box} py-3 leading-relaxed ${p.className ?? ''}`} />;
const L = ({ t, children }: { t: string; children: ReactNode }) => <label className="block"><div className="text-xs text-cream/60 mb-1 px-1">{t}</div>{children}</label>;
const Ring = ({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) => (
  <button type="button" aria-label={label} onClick={onClick} className={`w-8 h-8 flex-none rounded-full border-2 ${on ? 'bg-sand border-sand-light' : 'border-cream/50'}`} />
);

export function FillModal() {
  const { sheet, filling, fill, updateBlock, spellMap, edit } = useStore();
  const src = sheet?.pages.flatMap((p) => p.blocks).find((b) => b.id === filling);
  const [d, setD] = useState<Block | undefined>(src);
  useEffect(() => { setD(src ? structuredClone(src) : undefined); }, [filling]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sheet) return null;
  const set = (patch: Partial<Block>) => setD((x) => (x ? { ...x, ...patch } : x));
  const save = () => { if (d) updateBlock(d.id, d, true); fill(undefined); };
  const calc = d ? calcSheet({ ...sheet, pages: sheet.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === d.id ? d : b)) })) }) : undefined;

  const body = (b: Block): ReactNode => {
    switch (b.type) {
      case 'title': case 'field':
        return <L t="Что вписать"><In value={b.value ?? ''} onChange={(e) => set({ value: e.target.value })} autoFocus /></L>;
      case 'text':
        if (b.parts?.length) return b.parts.map((title, i) => (
          <div key={i} className="grid gap-2">
            <L t={`Заголовок колонки ${i + 1}`}><In value={title} onChange={(e) => set({ parts: b.parts!.map((x, j) => (j === i ? e.target.value : x)) })} /></L>
            <Area rows={7} value={b.values?.[i] ?? ''} placeholder={title} onChange={(e) => set({ values: b.parts!.map((_, j) => (j === i ? e.target.value : b.values?.[j] ?? '')) })} />
          </div>
        ));
        return <L t="Текст"><Area rows={12} value={b.value ?? ''} onChange={(e) => set({ value: e.target.value })} /></L>;
      case 'image':
        return (
          <div className="grid gap-3">
            {b.src && <img src={b.src} alt="" className="w-full max-h-[45vh] object-contain rounded-xl bg-black/20" />}
            <label className="h-12 rounded-xl bg-moss border border-moss-light inline-flex items-center justify-center gap-2 cursor-pointer"><ImagePlus size={18} />{b.src ? 'Заменить картинку' : 'Выбрать картинку'}
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) set({ src: await downscale(f, 900) }); }} />
            </label>
            {b.src && <button className="h-12 rounded-xl border border-red-400/60 text-red-300" onClick={() => set({ src: undefined })}>Убрать картинку</button>}
          </div>
        );
      case 'ability':
        return (
          <div className="grid grid-cols-2 gap-3">
            <L t="Значение"><In inputMode="numeric" value={b.score ?? ''} placeholder="10" onChange={(e) => set({ score: e.target.value.replace(/[^\d]/g, '').slice(0, 2) })} className="text-2xl text-center" /></L>
            <L t="Модификатор (считается сам)"><In value={b.mod ?? ''} placeholder={abilityMod(b.score ?? '') || '±'} onChange={(e) => set({ mod: e.target.value })} className="text-2xl text-center" /></L>
          </div>
        );
      case 'stat': {
        const auto = autoStat(b, calc!);
        return <L t={auto ? `Число (если пусто — ${auto}, посчитано само)` : 'Число'}><In value={b.value ?? ''} placeholder={auto} onChange={(e) => set({ value: e.target.value })} className="text-2xl text-center" autoFocus={!auto} /></L>;
      }
      case 'checklist':
        return (
          <div className="grid gap-1.5">
            <div className="text-xs text-cream/60 px-1">Кружок — владение (добавляет бонус мастерства). Число считается само, можно вписать своё.</div>
            {(b.items ?? []).map((it, i) => {
              const a = autoItem(it, calc!.mods, calc!.prof);
              const up = (patch: Partial<typeof it>) => set({ items: b.items!.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-moss-light/30">
                  <Ring on={!!it.checked} onClick={() => up({ checked: !it.checked })} label={`Владение: ${it.name}`} />
                  <div className="flex-1 min-w-0 leading-tight">{it.name}{it.sub && <span className="text-cream/50 text-sm"> {it.sub}</span>}</div>
                  <input inputMode="text" className={`${base} flex-none h-10 text-center`} style={{ width: 64 }} value={it.value ?? ''} placeholder={a === undefined ? '—' : signed(a)} onChange={(e) => up({ value: e.target.value })} />
                </div>
              );
            })}
          </div>
        );
      case 'circles':
        return (b.rows ?? []).map((r, i) => (
          <div key={i} className="flex items-center gap-3 flex-wrap py-1">
            <div className="w-28 flex-none">{r.name}</div>
            {Array.from({ length: r.count }, (_, k) => <Ring key={k} on={k < r.filled} label={`${r.name} ${k + 1}`} onClick={() => set({ rows: b.rows!.map((x, j) => (j === i ? { ...x, filled: k < x.filled ? k : k + 1 } : x)) })} />)}
          </div>
        ));
      case 'table': {
        const cols = b.columns ?? [];
        const cells = b.cells ?? [];
        const setCell = (r: number, c: number, v: string) => set({ cells: cells.map((row, ri) => (ri === r ? cols.map((_, ci) => (ci === c ? v : row[ci] ?? '')) : row)) });
        return (
          <div className="grid gap-2">
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="border-separate border-spacing-1" style={{ minWidth: cols.length * 96 }}>
                <thead><tr>{cols.map((c, i) => <th key={i} className="text-xs text-cream/60 font-normal text-left px-1">{c}</th>)}</tr></thead>
                <tbody>{cells.map((row, r) => <tr key={r}>{cols.map((_, c) => <td key={c}><input className={`${box} h-11 px-2`} value={row[c] ?? ''} onChange={(e) => setCell(r, c, e.target.value)} /></td>)}</tr>)}</tbody>
              </table>
            </div>
            <button className="h-11 rounded-xl bg-moss border border-moss-light inline-flex items-center justify-center gap-2" onClick={() => set({ cells: [...cells, cols.map(() => '')] })}><Plus size={18} />Строка</button>
          </div>
        );
      }
      case 'spells': {
        const list = sheet.spells.map((s) => ({ s, sp: spellOf(s, spellMap) })).filter((x) => x.sp && x.sp.lvl >= (b.minLevel ?? 0) && x.sp.lvl <= (b.maxLevel ?? 9));
        return (
          <div className="grid gap-2">
            <button className="h-12 rounded-xl bg-gradient-to-b from-sand-light to-sand text-moss-deep font-semibold inline-flex items-center justify-center gap-2"
              onClick={() => useStore.setState({ picker: { min: b.minLevel ?? 0, max: b.maxLevel ?? 9 } } as never)}><Plus size={18} />Добавить заклинания</button>
            {!list.length && <div className="text-sm text-cream/50 text-center py-3">Пока пусто</div>}
            {list.map(({ s, sp }) => (
              <div key={s.key} className="flex items-center gap-3 py-1">
                <Ring on={s.prepared} label="Подготовлено" onClick={() => edit((sh) => ({ ...sh, spells: sh.spells.map((x) => (x.key === s.key ? { ...x, prepared: !x.prepared } : x)) }))} />
                <div className="flex-1 min-w-0">{sp!.ru ?? sp!.name}<span className="text-cream/50 text-sm"> · {sp!.lvl || 'заговор'}</span></div>
                <button className="w-10 h-10 grid place-items-center text-red-300" aria-label="Убрать" onClick={() => edit((sh) => ({ ...sh, spells: sh.spells.filter((x) => x.key !== s.key) }))}><Trash2 size={18} /></button>
              </div>
            ))}
            <div className="text-xs text-cream/50 px-1">Кружок — заклинание подготовлено. Отметки и список сохраняются сразу.</div>
          </div>
        );
      }
      default: return null;
    }
  };

  return (
    <AnimatePresence>
      {d && (
        <motion.div className="fixed inset-0 z-50 no-print bg-moss-dark flex flex-col" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.18 }}>
          <div className="safe-top border-b border-moss-light/60">
            <div className="max-w-xl mx-auto h-14 px-2 flex items-center gap-2">
              <button className="h-11 px-3 text-cream/80" onClick={() => fill(undefined)}>Отмена</button>
              <div className="flex-1 text-center font-display-sc text-lg text-sand-light truncate">{d.label || BLOCK_NAMES[d.type]}</div>
              <button className="h-11 px-4 rounded-xl bg-gradient-to-b from-sand-light to-sand text-moss-deep font-semibold" onClick={save}>Сохранить</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-xl mx-auto p-4 grid gap-4 pb-24">
              <L t="Название блока"><In value={d.label} onChange={(e) => set({ label: e.target.value })} /></L>
              {body(d)}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
