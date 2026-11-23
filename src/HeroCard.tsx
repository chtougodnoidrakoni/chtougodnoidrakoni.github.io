import { useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Btn } from './Panels';
import { useStore } from './store';
import { CONDITIONS } from './play';
import { LevelUpButton } from './LevelUp';
import { autoStat, calcSheet, keyOf, sheetName, sheetSystem, uid, type Block, type Charge, type Sheet } from './model';

const all = (s: Sheet) => s.pages.flatMap((p) => p.blocks);
const num = (v?: string) => { const m = (v ?? '').replace('−', '-').match(/-?\d+/); return m ? parseInt(m[0], 10) : undefined; };
const tile = 'rounded-2xl bg-moss-deep border border-moss-light';

/** Число со счётчиком ±: значение берётся из блока листа по подписи (или из play.cur). */
function Counter({ title, value, max, onSet, big }: { title: string; value?: number; max?: number; onSet: (v: number) => void; big?: boolean }) {
  const [delta, setDelta] = useState('');
  const v = value ?? 0;
  const clamp = (x: number) => (max !== undefined ? Math.max(0, Math.min(max, x)) : Math.max(0, x));
  return (
    <div className={`${tile} p-3`}>
      <div className="text-xs text-cream/60 text-center">{title}</div>
      <div className="flex items-center justify-center gap-2 my-1">
        <button className="w-11 h-11 rounded-full border border-moss-light grid place-items-center text-cream active:bg-sand/20" onClick={() => onSet(clamp(v - 1))} aria-label={`${title}: минус 1`}><Minus size={20} /></button>
        <div className={`font-display-sc ${big ? 'text-5xl' : 'text-4xl'} text-cream min-w-[3ch] text-center leading-none`}>{value ?? '—'}{max !== undefined && <span className="text-lg text-cream/45">/{max}</span>}</div>
        <button className="w-11 h-11 rounded-full border border-moss-light grid place-items-center text-cream active:bg-sand/20" onClick={() => onSet(clamp(v + 1))} aria-label={`${title}: плюс 1`}><Plus size={20} /></button>
      </div>
      {big && (
        <div className="flex gap-1.5 mt-1">
          <input inputMode="numeric" placeholder="число" value={delta} onChange={(e) => setDelta(e.target.value.replace(/\D/g, '').slice(0, 3))} className="w-20 h-10 px-2 rounded-xl bg-moss-dark border border-moss-light text-center text-cream outline-none focus:border-sand" />
          <Btn className="flex-1 !px-2 !text-[#e39a8f]" onClick={() => { const d = parseInt(delta, 10); if (d) { onSet(clamp(v - d)); setDelta(''); } }}>Урон</Btn>
          <Btn className="flex-1 !px-2 !text-[#9fd59a]" onClick={() => { const d = parseInt(delta, 10); if (d) { onSet(clamp(v + d)); setDelta(''); } }}>Лечение</Btn>
        </div>
      )}
    </div>
  );
}

export function HeroCard() {
  const { sheet, commit } = useStore();
  const [newCh, setNewCh] = useState<Charge | null>(null);
  const [condInfo, setCondInfo] = useState('');
  if (!sheet) return null;
  const sys = sheetSystem(sheet); const blocks = all(sheet); const c = calcSheet(sheet);
  const by = (l: string) => blocks.find((b) => b.label === l);
  const setBlock = (pred: (b: Block) => boolean, patch: (b: Block) => Partial<Block>) => commit((s) => ({ ...s, pages: s.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (pred(b) ? { ...b, ...patch(b) } : b)) })) }));
  const setVal = (l: string, v: number | string) => setBlock((b) => b.label === l, () => ({ value: String(v) }));
  const play = sheet.play ?? {};
  const setPlay = (fn: (p: NonNullable<Sheet['play']>) => NonNullable<Sheet['play']>) => commit((s) => ({ ...s, play: fn(s.play ?? {}) }));
  const statVal = (b?: Block) => (b ? b.value || autoStat(b, c) : '');
  const sub = [by('Класс')?.value, by('Подкласс')?.value, by('Вид')?.value, by('Уровень')?.value && `${by('Уровень')!.value} ур.`, by('Род занятий')?.value, by('Роль')?.value].filter(Boolean).join(' · ');

  const circles = (b: Block | undefined, title?: string) => b && (
    <div className={`${tile} p-3`}>
      <div className="text-xs text-cream/60 mb-2">{title ?? b.label}</div>
      <div className="grid gap-2">
        {(b.rows ?? []).filter((r) => r.count > 0).map((r, ri) => (
          <div key={ri} className="flex items-center gap-2">
            {(b.rows!.length > 1 || r.name !== b.label) && <span className="text-sm text-cream/80 w-24 shrink-0 truncate">{r.name}</span>}
            <div className="flex flex-wrap gap-1.5">{Array.from({ length: r.count }, (_, i) => (
              <button key={i} aria-label={`${r.name} ${i + 1}`} onClick={() => setBlock((x) => x.id === b.id, (x) => ({ rows: x.rows!.map((rr, j) => (j === ri ? { ...rr, filled: rr.filled === i + 1 ? i : i + 1 } : rr)) }))}
                className={`w-8 h-8 rounded-full border-2 ${i < r.filled ? 'bg-sand border-sand' : 'border-sand/50'}`} />
            ))}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid gap-3">
      <div className="text-center">
        <div className="font-display-sc text-3xl text-sand-light leading-tight">{sheetName(sheet)}</div>
        {sub && <div className="text-sm text-cream/60">{sub}</div>}
      </div>

      {sys === 'dnd' && (
        <>
          <LevelUpButton />
          <Counter big title="Хиты" value={num(by('Текущие хиты')?.value) ?? num(by('Максимум хитов')?.value)} max={num(by('Максимум хитов')?.value)} onSet={(v) => setVal('Текущие хиты', v)} />
          <div className="grid grid-cols-2 gap-2">
            <Counter title="Временные хиты" value={num(by('Временные хиты')?.value) ?? 0} onSet={(v) => setVal('Временные хиты', v || '')} />
            <div className={`${tile} p-3 grid grid-cols-2 gap-y-1 text-center`}>
              {[['КД', 'Класс доспеха'], ['Иниц.', 'Инициатива'], ['Скорость', 'Скорость'], ['Мастер.', 'Бонус мастерства']].map(([t, l]) => {
                const b = blocks.find((x) => x.label === l || keyOf(x) === (l === 'Инициатива' ? 'init' : l === 'Бонус мастерства' ? 'prof' : '_'));
                return <div key={l}><div className="text-[11px] text-cream/55">{t}</div><div className="text-xl text-cream font-semibold leading-tight">{statVal(b) || '—'}</div></div>;
              })}
            </div>
          </div>
          {circles(by('Спасброски от смерти'))}
          {circles(by('Ячейки заклинаний'), 'Ячейки заклинаний — отметьте потраченные')}
        </>
      )}
      {sys === 'coc' && (
        <div className="grid grid-cols-2 gap-2">
          {[['ПЗ', 'Пункты здоровья (ПЗ)', 'coc:hp'], ['ПМ', 'Пункты магии (ПМ)', 'coc:mp'], ['Рассудок', 'Рассудок', 'coc:sanmax'], ['Удача', 'Удача', '']].map(([t, l, k]) => {
            const mb = k ? blocks.find((b) => b.key === k) : undefined; const max = mb ? num(statVal(mb)) : 99;
            return <Counter key={l} title={t!} value={num(by(l!)?.value) ?? (k === 'coc:sanmax' ? num(statVal(blocks.find((b) => b.key === 'coc:san'))) : max)} max={max} onSet={(v) => setVal(l!, v)} />;
          })}
        </div>
      )}
      {sys === 'bitd' && <>{circles(by('Стресс'))}{circles(by('Травмы'))}{circles(by('Нагрузка'))}{circles(by('Броня'))}</>}
      {sys === 'cpr' && (() => {
        const max = num(statVal(blocks.find((b) => b.key === 'cpr:hp'))); const hum = num(statVal(blocks.find((b) => b.key === 'cpr:hum')));
        return (
          <>
            <Counter big title={`Хиты${num(statVal(blocks.find((b) => b.key === 'cpr:sw'))) ? ` · тяжёлое ранение при ${statVal(blocks.find((b) => b.key === 'cpr:sw'))}` : ''}`} value={play.cur?.hp ?? max} max={max} onSet={(v) => setPlay((p) => ({ ...p, cur: { ...p.cur, hp: v } }))} />
            <Counter title="Человечность" value={play.cur?.hum ?? hum} max={hum} onSet={(v) => setPlay((p) => ({ ...p, cur: { ...p.cur, hum: v } }))} />
          </>
        );
      })()}

      <div className={`${tile} p-3`}>
        <div className="flex items-center mb-2"><div className="text-xs text-cream/60 flex-1">Способности с зарядами</div><button className="text-sm text-sand-light" onClick={() => setNewCh({ id: uid(), name: '', max: 1, used: 0, reset: 'long' })}>+ добавить</button></div>
        {!play.charges?.length && !newCh && <p className="text-xs text-cream/50">Например «Ярость 3», «Божественное чувство 4», «Вдохновение барда». Тратьте касанием — отдых восстановит сам.</p>}
        <div className="grid gap-2">
          {play.charges?.map((ch) => (
            <div key={ch.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-cream truncate">{ch.name}<span className="text-[11px] text-cream/45"> · {ch.reset === 'short' ? 'короткий' : 'долгий'} отдых</span></span>
              <div className="flex flex-wrap gap-1 justify-end max-w-[55%]">{Array.from({ length: ch.max }, (_, i) => (
                <button key={i} aria-label={`${ch.name} ${i + 1}`} onClick={() => setPlay((p) => ({ ...p, charges: p.charges!.map((x) => (x.id === ch.id ? { ...x, used: x.used === i + 1 ? i : i + 1 } : x)) }))}
                  className={`w-7 h-7 rotate-45 rounded-[4px] border-2 ${i < ch.used ? 'border-sand/30 bg-transparent' : 'border-sand bg-sand/80'}`} />
              ))}</div>
              <button className="w-8 h-8 grid place-items-center text-cream/40" aria-label="Удалить" onClick={() => setPlay((p) => ({ ...p, charges: p.charges!.filter((x) => x.id !== ch.id) }))}><Trash2 size={15} /></button>
            </div>
          ))}
          {newCh && (
            <div className="grid gap-2 border-t border-moss-light pt-2">
              <input autoFocus placeholder="Название, например «Ярость»" value={newCh.name} onChange={(e) => setNewCh({ ...newCh, name: e.target.value })} className="h-10 px-3 rounded-xl bg-moss-dark border border-moss-light text-cream outline-none focus:border-sand" />
              <div className="flex gap-2 items-center">
                <span className="text-sm text-cream/70">Зарядов</span>
                <input inputMode="numeric" value={String(newCh.max)} onChange={(e) => setNewCh({ ...newCh, max: Math.max(1, Math.min(20, parseInt(e.target.value || '1', 10))) })} className="w-14 h-10 px-2 rounded-xl bg-moss-dark border border-moss-light text-center text-cream outline-none" />
                <select value={newCh.reset} onChange={(e) => setNewCh({ ...newCh, reset: e.target.value as Charge['reset'] })} className="flex-1 h-10 px-2 rounded-xl bg-moss-dark border border-moss-light text-cream"><option value="long">после долгого отдыха</option><option value="short">после короткого</option></select>
              </div>
              <div className="flex gap-2"><Btn className="flex-1" onClick={() => setNewCh(null)}>Отмена</Btn><Btn tone="gold" className="flex-1" onClick={() => { if (!newCh.name.trim()) return; setPlay((p) => ({ ...p, charges: [...(p.charges ?? []), { ...newCh, name: newCh.name.trim() }] })); setNewCh(null); }}>Добавить</Btn></div>
            </div>
          )}
        </div>
      </div>

      {sys === 'dnd' && (
        <div className={`${tile} p-3`}>
          <div className="text-xs text-cream/60 mb-2">Состояния — нажмите, чтобы отметить; ниже появится пояснение</div>
          <div className="flex flex-wrap gap-1.5">{CONDITIONS.map(([n, d]) => {
            const on = play.conditions?.includes(n);
            return <button key={n} onClick={() => { setPlay((p) => ({ ...p, conditions: on ? p.conditions!.filter((x) => x !== n) : [...(p.conditions ?? []), n] })); setCondInfo(`${n}: ${d}`); }}
              className={`px-2.5 h-8 rounded-full border text-xs ${on ? 'border-[#e39a8f] bg-[#e39a8f]/20 text-[#f1b8ae]' : 'border-moss-light text-cream/70'}`}>{n}</button>;
          })}</div>
          {condInfo && <p className="text-xs text-cream/70 mt-2 leading-relaxed">{condInfo}</p>}
        </div>
      )}
      <p className="text-xs text-cream/45 text-center">Всё, что меняется здесь, сразу пишется в лист. Ошиблись — стрелка «отменить».</p>
    </div>
  );
}
