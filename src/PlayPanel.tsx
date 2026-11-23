import { useMemo, useState } from 'react';
import { BedDouble, Dices, Tent } from 'lucide-react';
import { Btn, Sheet } from './Panels';
import { useStore } from './store';
import { doRoll, hitDie, longRest, rollables, rollDice, type Edge, type Rollable, type RollResult } from './play';
import { sheetSystem, signed } from './model';

const TONE: Record<string, string> = { crit: 'text-[#f3d27a]', good: 'text-[#9fd59a]', mid: 'text-[#e8c07a]', bad: 'text-[#e39a8f]', fumble: 'text-[#ff7b6b]' };
const FREE = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100', '2d6', '3d6', '4d6'];

export function PlayPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sheet, commit, say } = useStore();
  const [edge, setEdge] = useState<Edge>('none');
  const [coc, setCoc] = useState(0);
  const [hist, setHist] = useState<RollResult[]>([]);
  const [tab, setTab] = useState<'roll' | 'rest'>('roll');
  const [q, setQ] = useState('');
  const list = useMemo(() => (sheet && open ? rollables(sheet) : []), [sheet, open]);
  if (!sheet) return null;
  const sys = sheetSystem(sheet);
  const push = (r: RollResult) => { setHist((h) => [r, ...h].slice(0, 30)); if (navigator.vibrate) navigator.vibrate(18); };
  const roll = (r: Rollable) => {
    const res = doRoll(r, edge, coc);
    push(res);
    if (r.dmg) { const dm = rollDice(r.dmg); if (dm) push({ title: `${r.name} — урон${res.tone === 'crit' ? ' (крит: кубы урона удвоены)' : ''}`, total: res.tone === 'crit' ? dm.total + (rollDice(r.dmg.replace(/[+-−]\d+.*/, ''))?.total ?? 0) : dm.total, detail: dm.detail + (r.dmg.match(/\s(.+)$/)?.[1] ? ` · ${r.dmg.match(/\s(.+)$/)![1]}` : ''), at: Date.now() }); }
  };
  const groups = [...new Set(list.map((x) => x.group))];
  const shown = q.trim() ? list.filter((x) => x.name.toLowerCase().includes(q.trim().toLowerCase())) : list;
  const last = hist[0];
  const chip = (on: boolean) => `h-9 px-3 rounded-full border text-sm ${on ? 'border-sand bg-sand/20 text-sand-light' : 'border-moss-light text-cream/75'}`;

  return (
    <Sheet open={open} onClose={onClose} title="Игра">
      <div className="grid gap-3">
        {sys === 'dnd' && (
          <div className="grid grid-cols-2 gap-2">
            <button className={chip(tab === 'roll')} onClick={() => setTab('roll')}><Dices size={15} className="inline -mt-0.5 mr-1" />Броски</button>
            <button className={chip(tab === 'rest')} onClick={() => setTab('rest')}><Tent size={15} className="inline -mt-0.5 mr-1" />Отдых</button>
          </div>
        )}

        {last && tab === 'roll' && (
          <div className="sticky top-0 z-10 rounded-2xl border border-sand/50 bg-moss-deep px-4 py-3 text-center shadow-[0_8px_20px_rgba(0,0,0,.5)]">
            <div className="text-xs text-cream/60 truncate">{last.title}</div>
            <div className={`font-display-sc text-5xl leading-tight ${TONE[last.tone ?? ''] ?? 'text-cream'}`}>{last.total}</div>
            {last.verdict && <div className={`text-sm font-semibold ${TONE[last.tone ?? ''] ?? ''}`}>{last.verdict}</div>}
            <div className="text-xs text-cream/55 mt-0.5">{last.detail}</div>
          </div>
        )}

        {tab === 'roll' && (
          <>
            {sys === 'dnd' && <div className="flex gap-2">{([['none', 'Обычный'], ['adv', 'Преимущество'], ['dis', 'Помеха']] as const).map(([k, l]) => <button key={k} className={chip(edge === k)} onClick={() => setEdge(k)}>{l}</button>)}</div>}
            {sys === 'coc' && <div className="flex gap-2 flex-wrap">{([[0, 'Обычный'], [1, 'Бонусный'], [2, '2 бонусных'], [-1, 'Штрафной'], [-2, '2 штрафных']] as const).map(([k, l]) => <button key={k} className={chip(coc === k)} onClick={() => setCoc(k)}>{l}</button>)}</div>}
            {sys === 'bitd' && <p className="text-xs text-cream/55">Пул = точки действия. Добавьте кубы за помощь, рывок или дьявольскую сделку свободными бросками ниже (к6).</p>}
            {list.length > 8 && <input className="w-full h-10 px-3 rounded-xl bg-moss-deep border border-moss-light text-cream outline-none focus:border-sand" placeholder="Найти: внимательность, меч…" value={q} onChange={(e) => setQ(e.target.value)} />}
            {!list.length && <p className="text-sm text-cream/65">Заполните характеристики и навыки на листе — здесь появятся кнопки бросков. Пока можно кидать любые кубы.</p>}
            {groups.map((g) => {
              const items = shown.filter((x) => x.group === g); if (!items.length) return null;
              return (
                <div key={g}>
                  <div className="text-xs uppercase tracking-wider text-sand-light/80 mb-1.5 px-1">{g}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((r, i) => (
                      <button key={g + i} onClick={() => roll(r)} className="min-h-10 px-3 py-1.5 rounded-xl bg-moss-deep border border-moss-light text-left flex items-center gap-2 active:bg-sand/20">
                        <span className="flex-1 text-sm text-cream leading-tight">{r.name}{r.dmg && <span className="block text-[11px] text-cream/50">урон {r.dmg}</span>}</span>
                        <span className="text-sm text-sand-light font-semibold whitespace-nowrap">{r.kind === 'd20' || r.kind === 'd10' ? signed(r.mod ?? 0) : r.kind === 'd100' ? `${r.target}%` : r.kind === 'pool' ? `${r.pool}к6` : ''}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <div>
              <div className="text-xs uppercase tracking-wider text-sand-light/80 mb-1.5 px-1">Любые кубы</div>
              <div className="grid grid-cols-5 gap-1.5">{FREE.map((x) => <button key={x} className="h-10 rounded-xl bg-moss-deep border border-moss-light text-sm text-cream active:bg-sand/20" onClick={() => { const r = rollDice(x)!; push({ title: x.replace('d', 'к'), total: r.total, detail: r.detail, at: Date.now() }); }}>{x.replace('1d', 'к').replace('d', 'к')}</button>)}</div>
            </div>
            {hist.length > 1 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-sand-light/80 mb-1 px-1">История</div>
                <div className="grid gap-1">{hist.slice(1, 12).map((h) => <div key={h.at + h.title} className="flex justify-between text-xs text-cream/70 px-1"><span className="truncate pr-2">{h.title}{h.verdict ? ` · ${h.verdict}` : ''}</span><b className={TONE[h.tone ?? ''] ?? 'text-cream'}>{h.total}</b></div>)}</div>
              </div>
            )}
          </>
        )}

        {tab === 'rest' && sys === 'dnd' && (
          <div className="grid gap-3">
            <div className="rounded-2xl border border-moss-light bg-moss-deep p-4 grid gap-2">
              <div className="font-display-sc text-xl text-sand-light">Короткий отдых</div>
              <p className="text-sm text-cream/70">Час передышки. Можно потратить кости хитов: каждая лечит бросок кости + модификатор Телосложения. Берётся размер кости из поля «Кости хитов» (например, 5к10).</p>
              <Btn onClick={() => { const r = hitDie(sheet); if (!r) { say('Впишите на листе «Кости хитов», например 5к10'); return; } commit(() => r.sheet); push({ title: 'Кость хитов', total: 0, detail: r.text, at: Date.now() }); say(r.text); }}><Dices size={18} />Потратить кость хитов</Btn>
            </div>
            <div className="rounded-2xl border border-moss-light bg-moss-deep p-4 grid gap-2">
              <div className="font-display-sc text-xl text-sand-light">Долгий отдых</div>
              <p className="text-sm text-cream/70">Восемь часов сна. Текущие хиты станут равны максимуму, временные хиты и спасброски от смерти сбросятся, все ячейки заклинаний восстановятся.</p>
              <Btn tone="gold" onClick={() => { commit(longRest); say('Долгий отдых: хиты и ячейки восстановлены'); }}><BedDouble size={18} />Отдохнуть</Btn>
            </div>
            <p className="text-xs text-cream/50">Ошиблись — стрелка «отменить» вверху вернёт всё как было.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
