import { useState } from 'react';
import { ArrowUpCircle, Dices } from 'lucide-react';
import { Btn, Sheet } from './Panels';
import { useStore } from './store';
import { applyLevel, avgText, CLASSES, currentLevel, findClass, plan } from './levelup';
import { calcSheet } from './model';

const NAMES: Record<string, string> = { barbarian: 'Варвар', bard: 'Бард', cleric: 'Жрец', druid: 'Друид', fighter: 'Воин', monk: 'Монах', paladin: 'Паладин', ranger: 'Следопыт', rogue: 'Плут', sorcerer: 'Чародей', warlock: 'Колдун', wizard: 'Волшебник' };

export function LevelUpButton() {
  const [open, setOpen] = useState(false);
  return <><Btn tone="gold" className="w-full" onClick={() => setOpen(true)}><ArrowUpCircle size={18} />Новый уровень</Btn><LevelUp open={open} onClose={() => setOpen(false)} /></>;
}

function LevelUp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sheet, commit, say } = useStore();
  const [clsId, setClsId] = useState<string | null>(null);
  const [hp, setHp] = useState<number | null>(null);
  const [write, setWrite] = useState(true);
  if (!sheet) return null;
  const cls = CLASSES.find((c) => c.id === clsId) ?? findClass(sheet);
  const lvl = currentLevel(sheet);
  const con = calcSheet(sheet).mods['ТЕЛ'] ?? 0;
  const close = () => { setHp(null); setClsId(null); onClose(); };
  const p = cls ? plan(sheet, cls, hp ?? 'avg') : undefined;
  return (
    <Sheet open={open} onClose={close} title="Новый уровень"
      footer={cls && lvl < 20 ? <div className="pb-3"><Btn tone="gold" className="w-full" disabled={hp === null} onClick={() => { commit((s) => applyLevel(s, plan(s, cls, hp!), write)); say(`Уровень ${p!.to}! Хиты +${p!.hpGain}`); close(); }}>Поднять до {lvl + 1} уровня</Btn></div> : undefined}>
      <div className="grid gap-3">
        {!lvl && <p className="text-sm text-[#e39a8f]">Сначала впишите на листе текущий уровень.</p>}
        {lvl >= 20 && <p className="text-sm text-cream/70">20 уровень — это максимум.</p>}
        {!findClass(sheet) && (
          <div>
            <div className="text-xs text-cream/60 mb-1.5">Не узнал класс в поле «Класс». Выберите:</div>
            <div className="flex flex-wrap gap-1.5">{CLASSES.map((c) => <button key={c.id} onClick={() => setClsId(c.id)} className={`px-3 h-9 rounded-full border text-sm ${cls?.id === c.id ? 'border-sand bg-sand/20 text-sand-light' : 'border-moss-light text-cream/75'}`}>{NAMES[c.id]}</button>)}</div>
          </div>
        )}
        {cls && lvl > 0 && lvl < 20 && p && (
          <>
            <div className="text-center"><div className="text-sm text-cream/60">{NAMES[cls.id]}</div><div className="font-display-sc text-4xl text-sand-light">{lvl} → {lvl + 1}</div></div>
            <div className="rounded-2xl border border-moss-light bg-moss-deep p-3 grid gap-2">
              <div className="text-sm text-cream">Хиты: кость к{cls.hd} + модификатор ТЕЛ</div>
              <div className="grid grid-cols-2 gap-2">
                <Btn tone={hp === cls.hd / 2 + 1 ? 'gold' : 'base'} onClick={() => setHp(cls.hd / 2 + 1)}>Среднее: {avgText(cls.hd, con)}</Btn>
                <Btn onClick={() => setHp(1 + Math.floor(Math.random() * cls.hd))}><Dices size={17} />Бросить к{cls.hd}</Btn>
              </div>
              {hp !== null && <div className="text-center text-lg text-cream">+{Math.max(1, hp + con)} к максимуму хитов <span className="text-sm text-cream/55">({hp}{con ? (con > 0 ? ` + ${con}` : ` − ${-con}`) : ''})</span></div>}
            </div>
            <div className="rounded-2xl border border-moss-light bg-moss-deep p-3">
              <div className="text-sm text-cream mb-1.5">Что даёт {lvl + 1} уровень</div>
              <ul className="list-disc pl-5 text-sm text-cream/80 grid gap-1">
                {p.feats.map((f) => <li key={f}>{f}</li>)}
                {p.asi && <li><b className="text-sand-light">Увеличение характеристик:</b> +2 к одной или +1 к двум (максимум 20), либо черта, если мастер разрешает. Впишите новые значения на листе.</li>}
                {(lvl + 1 - 1) % 4 === 0 && <li>Бонус мастерства растёт — лист пересчитает сам.</li>}
                {p.slots && <li>Ячейки заклинаний обновятся по таблице класса.</li>}
                {!p.feats.length && !p.asi && <li>Новых умений класса нет: только хиты{p.slots ? ' и ячейки' : ''}.</li>}
              </ul>
              <label className="flex items-center gap-2 mt-2 text-sm text-cream/80"><input type="checkbox" className="w-5 h-5 accent-[#aa9173]" checked={write} onChange={(e) => setWrite(e.target.checked)} />Записать умения в блок «Способности класса»</label>
            </div>
            <p className="text-xs text-cream/50">Автоматически: уровень, максимум и текущие хиты, кости хитов, ячейки заклинаний, заряды (Ярость, Ци, очки чародейства, дикий облик). По правилам SRD 5.1 (2014); в редакции 2024 часть умений другая — сверьтесь с книгой. Мультикласс не поддерживается. Ошиблись — стрелка «отменить».</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
