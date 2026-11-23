import { useState } from 'react';
import { ArrowUpCircle, BookOpen, Dices } from 'lucide-react';
import { Btn, Sheet } from './Panels';
import { useStore } from './store';
import { applyMC, avgText, CLASS_RU, CLASSES, currentLevel, findClass, getClasses, MC_PROF, planMC, prereqProblems } from './levelup';
import { calcSheet } from './model';

const GEN: Record<string, string> = { barbarian: 'варвара', bard: 'барда', cleric: 'жреца', druid: 'друида', fighter: 'воина', monk: 'монаха', paladin: 'паладина', ranger: 'следопыта', rogue: 'плута', sorcerer: 'чародея', warlock: 'колдуна', wizard: 'волшебника' };

export function LevelUpButton() {
  const [open, setOpen] = useState(false);
  return <><Btn tone="gold" className="w-full" onClick={() => setOpen(true)}><ArrowUpCircle size={18} />Новый уровень</Btn><LevelUp open={open} onClose={() => setOpen(false)} /></>;
}

function LevelUp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sheet, commit, say, close: closeSheet } = useStore();
  const [pick, setPick] = useState<string | null>(null);
  const [mc, setMc] = useState(false);
  const [hp, setHp] = useState<number | null>(null);
  const [write, setWrite] = useState(true);
  if (!sheet) return null;
  const classes = getClasses(sheet);
  const total = classes.reduce((a, c) => a + c.level, 0) || currentLevel(sheet);
  const clsId = pick ?? classes[0]?.id ?? findClass(sheet)?.id ?? null;
  const cls = CLASSES.find((c) => c.id === clsId);
  const con = calcSheet(sheet).mods['ТЕЛ'] ?? 0;
  const close = () => { setHp(null); setPick(null); setMc(false); onClose(); };
  const isNew = !!cls && classes.length > 0 && !classes.some((c) => c.id === cls.id);
  const p = cls && hp !== null ? planMC(sheet, cls.id, hp) : cls ? planMC(sheet, cls.id, cls.hd / 2 + 1) : undefined;
  const problems = isNew && cls ? prereqProblems(sheet, [...classes.map((c) => c.id), cls.id]) : [];
  const chip = (on: boolean) => `px-3 h-9 rounded-full border text-sm ${on ? 'border-sand bg-sand/20 text-sand-light' : 'border-moss-light text-cream/75'}`;
  const noLevel = !currentLevel(sheet) && !classes.length;
  return (
    <Sheet open={open} onClose={close} title="Новый уровень"
      footer={cls && !noLevel && total < 20 ? <div className="pb-3"><Btn tone="gold" className="w-full" disabled={hp === null} onClick={() => { const pl = planMC(sheet, cls.id, hp!); commit((s) => applyMC(s, pl, write)); say(`Уровень ${pl.total}! Хиты +${pl.hpGain}`); close(); }}>{hp === null ? 'Выберите хиты' : `Поднять до ${total + 1} уровня`}</Btn></div> : undefined}>
      <div className="grid gap-3">
        {noLevel && <p className="text-sm text-[#e39a8f]">Сначала впишите на листе класс и текущий уровень.</p>}
        {total >= 20 && <p className="text-sm text-cream/70">20 уровень — это максимум.</p>}
        {!noLevel && total < 20 && (
          <>
            <div>
              <div className="text-xs text-cream/60 mb-1.5">В каком классе берёте уровень</div>
              <div className="flex flex-wrap gap-1.5">
                {classes.map((c) => <button key={c.id} className={chip(cls?.id === c.id)} onClick={() => { setPick(c.id); setMc(false); setHp(null); }}>{CLASS_RU[c.id]} {c.level}</button>)}
                {!classes.length && !findClass(sheet) && <span className="text-xs text-cream/55">Класс в поле «Класс» не распознан — выберите ниже.</span>}
                <button className={chip(mc)} onClick={() => setMc(!mc)}>+ Другой класс (мультикласс)</button>
              </div>
              {(mc || (!classes.length && !findClass(sheet))) && <div className="flex flex-wrap gap-1.5 mt-2">{CLASSES.filter((c) => !classes.some((x) => x.id === c.id)).map((c) => <button key={c.id} className={chip(cls?.id === c.id)} onClick={() => { setPick(c.id); setHp(null); }}>{CLASS_RU[c.id]}</button>)}</div>}
            </div>
            {cls && p && (
              <>
                <div className="text-center"><div className="text-sm text-cream/60">{CLASS_RU[cls.id]} {p.classLevel} уровня · общий уровень</div><div className="font-display-sc text-4xl text-sand-light">{total} → {total + 1}</div></div>
                {isNew && (
                  <div className={`rounded-2xl border p-3 text-sm ${problems.length ? 'border-[#e39a8f]/60 bg-[#e39a8f]/10' : 'border-moss-light bg-moss-deep'}`}>
                    {problems.length ? <><b className="text-[#f1b8ae]">Не выполнены условия мультикласса:</b><ul className="list-disc pl-5 mt-1">{problems.map((x) => <li key={x}>{x}</li>)}</ul><p className="text-xs text-cream/60 mt-1">Можно продолжить, если мастер разрешил.</p></> : <span className="text-cream/80">Условия мультикласса выполнены.</span>}
                    <p className="mt-2 text-cream/80"><b>Владения от нового класса:</b> {MC_PROF[cls.id]}.</p>
                  </div>
                )}
                <div className="rounded-2xl border border-moss-light bg-moss-deep p-3 grid gap-2">
                  <div className="text-sm text-cream">Хиты: кость к{cls.hd} + модификатор ТЕЛ</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Btn tone={hp === cls.hd / 2 + 1 ? 'gold' : 'base'} onClick={() => setHp(cls.hd / 2 + 1)}>Среднее: {avgText(cls.hd, con)}</Btn>
                    <Btn onClick={() => setHp(1 + Math.floor(Math.random() * cls.hd))}><Dices size={17} />Бросить к{cls.hd}</Btn>
                  </div>
                  {hp !== null && <div className="text-center text-lg text-cream">+{Math.max(1, hp + con)} к максимуму хитов <span className="text-sm text-cream/55">({hp}{con ? (con > 0 ? ` + ${con}` : ` − ${-con}`) : ''})</span></div>}
                </div>
                <div className="rounded-2xl border border-moss-light bg-moss-deep p-3">
                  <div className="text-sm text-cream mb-1.5">Что даёт {p.classLevel} уровень {GEN[cls.id]}</div>
                  <ul className="list-disc pl-5 text-sm text-cream/80 grid gap-1">
                    {p.feats.map((f) => <li key={f}>{f}</li>)}
                    {p.asi && <li><b className="text-sand-light">Увеличение характеристик:</b> +2 к одной или +1 к двум (максимум 20), либо черта, если мастер разрешает. Впишите новые значения на листе.</li>}
                    {total % 4 === 0 && <li>Бонус мастерства растёт (по общему уровню) — лист пересчитает сам.</li>}
                    {p.slots && <li>Ячейки заклинаний обновятся{p.classes.length > 1 ? ' по общей таблице мультикласса' : ' по таблице класса'}.</li>}
                    {p.pact && <li>{p.pact[0]!.toUpperCase() + p.pact.slice(1)}.</li>}
                    {!p.feats.length && !p.asi && <li>Новых умений класса нет.</li>}
                  </ul>
                  <label className="flex items-center gap-2 mt-2 text-sm text-cream/80"><input type="checkbox" className="w-5 h-5 accent-[#aa9173]" checked={write} onChange={(e) => setWrite(e.target.checked)} />Записать умения в блок «Способности класса»</label>
                </div>
              </>
            )}
            <a href="#help-rules" onClick={() => { close(); closeSheet(); location.hash = '#help'; setTimeout(() => document.getElementById('help-rules')?.scrollIntoView(), 300); }} className="h-10 rounded-xl border border-moss-light text-sm text-cream/80 inline-flex items-center justify-center gap-2"><BookOpen size={16} />Памятка: уровни, черты, мультикласс</a>
            <p className="text-xs text-cream/50">Автоматически: уровень, хиты, кости хитов, ячейки, заряды, запись умений. По правилам SRD 5.1 (2014); в 2024 часть умений другая. Ошиблись — стрелка «отменить».</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
