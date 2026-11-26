import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Dices, RotateCcw, Search, Shield, Sparkles, Swords } from 'lucide-react';
import { set as idbSet, get as idbGet } from 'idb-keyval';
import { Btn, Field, TextIn } from '../Panels';
import { SCHOOLS, sheetName, type SpellData } from '../model';
import { ABS, AB_RU, AB_SHORT, ALIGNMENTS, ALL_SKILLS, ARMORS, BACKGROUNDS, DRAGONS, ORIGIN_FEATS, SKILLS, STYLES, WEAPONS, slots, type Ab, type Ed } from './data';
import { POINT_COST, STANDARD, abilityPriority, autoAssign, featById, prereqFail, allSkills, armorClass, armorProf, featureTexts, packSub, saves, subSpells, asiLevels, attacks, bgOf, classOf, emptyBuild, expertiseCount, feats, features, fixedSkills, maxHp, mod, originBonus, pb, problems, proficientWeapon, raceOf, rule, scores, sgn, speed, subAt, subName, subOf, type AsiPick, type Build } from './engine';
import { racialSpells, toSheet } from './toSheet';
import { backgroundsFor, classesFor, featsFor, racesFor, loadClub, loadLocal, setActive, subsFor, type StoredPack } from './content';
import { Library } from './Library';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');
const DRAFT = 'builder-draft';
const CLS_RU: Record<string, string> = { artificer: 'изобретатель', bard: 'бард', cleric: 'жрец', druid: 'друид', paladin: 'паладин', ranger: 'следопыт', sorcerer: 'чародей', warlock: 'колдун', wizard: 'волшебник' };

type StepId = 'ed' | 'level' | 'class' | 'race' | 'bg' | 'abil' | 'asi' | 'skills' | 'spells' | 'gear' | 'person' | 'done';
const STEPS: { id: StepId; title: string; show?: (b: Build) => boolean }[] = [
  { id: 'ed', title: 'Редакция' }, { id: 'level', title: 'Уровень' }, { id: 'class', title: 'Класс' },
  { id: 'race', title: 'Вид' }, { id: 'bg', title: 'Предыстория' }, { id: 'abil', title: 'Характеристики' },
  { id: 'asi', title: 'Улучшения', show: (b) => asiLevels(b).length > 0 }, { id: 'skills', title: 'Навыки' },
  { id: 'spells', title: 'Заклинания', show: (b) => !!rule(b) }, { id: 'gear', title: 'Снаряжение' },
  { id: 'person', title: 'Личность' }, { id: 'done', title: 'Итог' },
];

function load(): { b: Build; step: StepId } {
  try { const d = JSON.parse(localStorage.getItem(DRAFT) ?? ''); if (d?.b) return { b: { ...emptyBuild(), ...d.b }, step: d.step ?? 'ed' }; } catch { /* нет черновика */ }
  return { b: emptyBuild(), step: 'ed' };
}

export function Builder() {
  const init = useMemo(load, []);
  const [b, setB] = useState<Build>(init.b);
  const [step, setStep] = useState<StepId>(init.step);
  const [db, setDb] = useState<SpellData[]>([]);
  const [busy, setBusy] = useState(false);
  const [packs, setPacks] = useState<{ local: StoredPack[]; club: StoredPack[] }>({ local: [], club: [] });
  const [lib, setLib] = useState(() => location.hash === '#library');
  // сначала свои пакеты (быстро, из телефона), потом общие с сайта — и общие не затирают то, что успели импортировать
  useEffect(() => {
    void loadLocal().then((local) => setPacks((p) => { setActive([...p.club, ...local]); return { ...p, local }; }));
    void loadClub(import.meta.env.BASE_URL).then((club) => setPacks((p) => { setActive([...club, ...p.local]); return { ...p, club }; }));
  }, []);
  useEffect(() => { const f = () => setLib(location.hash === '#library'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const onPacks = (local: StoredPack[]) => setPacks((p) => { setActive([...p.club, ...local]); return { ...p, local }; });
  useEffect(() => { try { localStorage.setItem(DRAFT, JSON.stringify({ b, step })); } catch { /* приватный режим */ } }, [b, step]);
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}spells.json`).then((r) => r.json()).then(setDb).catch(() => {}); }, []);
  const up = (p: Partial<Build>) => setB((x) => ({ ...x, ...p }));
  const steps = STEPS.filter((s) => !s.show || s.show(b));
  const idx = Math.max(0, steps.findIndex((s) => s.id === step));
  const go = (i: number) => { const s = steps[Math.max(0, Math.min(steps.length - 1, i))]!; setStep(s.id); scrollTo(0, 0); };
  const probs = problems(b);
  const c = classOf(b);

  async function create() {
    setBusy(true);
    try {
      const sh = toSheet(b, db);
      await idbSet(`sheet:${sh.id}`, sh);
      const index = ((await idbGet('index')) ?? []) as { id: string }[];
      await idbSet('index', [{ id: sh.id, name: sheetName(sh), updatedAt: sh.updatedAt, system: 'dnd' }, ...index.filter((x) => x.id !== sh.id)]);
      location.href = `${import.meta.env.BASE_URL.replace(/builder\/?$/, '')}#sheet/${sh.id}`;
    } catch { alert('Не получилось сохранить лист. Попробуйте ещё раз.'); setBusy(false); }
  }

  if (lib) return <Library local={packs.local} club={packs.club} onChange={onPacks} onBack={() => { history.replaceState(null, '', location.pathname); setLib(false); scrollTo(0, 0); }} />;
  return (
    <div className="min-h-dvh pb-28">
      <header className="max-w-xl mx-auto px-4 pt-[max(1rem,env(safe-area-inset-top))] flex items-center gap-3">
        <a href={import.meta.env.BASE_URL.replace(/builder\/?$/, '')} aria-label="На главную"><img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="w-11 h-11 rounded-full" /></a>
        <div className="flex-1 min-w-0">
          <div className="font-display-sc text-xl text-sand-light leading-tight">Сборка персонажа</div>
          <div className="text-xs text-cream/60 truncate">{c ? `${b.name || 'Без имени'} · ${c.name} ${b.level} ур. · ${b.ed}` : `Что угодно и драконы · D&D 5e`}</div>
        </div>
        <button aria-label="Библиотека контента" onClick={() => { location.hash = '#library'; scrollTo(0, 0); }} className="w-10 h-10 grid place-items-center rounded-xl border border-moss-light text-sand-light shrink-0"><BookOpen size={18} /></button>
        {c && <div className="text-right text-xs leading-tight"><div><b className="text-sand-light text-base">{maxHp(b)}</b> хитов</div><div><b className="text-sand-light text-base">{armorClass(b).ac}</b> КД</div></div>}
      </header>
      <nav className="max-w-xl mx-auto px-4 mt-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {steps.map((s, i) => (
          <button key={s.id} onClick={() => go(i)} className={cx('shrink-0 h-8 px-3 rounded-full text-xs border inline-flex items-center gap-1', s.id === step ? 'bg-sand text-moss-deep border-sand font-semibold' : probs[s.id]?.length ? 'border-moss-light text-cream/70' : i < idx ? 'border-sand/50 text-sand-light' : 'border-moss-light text-cream/60')}>
            {i < idx && !probs[s.id]?.length && <Check size={12} />}{i + 1}. {s.title}
          </button>
        ))}
      </nav>
      <main className="max-w-xl mx-auto px-4 mt-4">
        <h1 className="font-display-sc text-3xl text-sand-light mb-1">{steps[idx]!.title}</h1>
        {probs[step]?.length ? <div className="text-xs text-amber-300/90 mb-3">{probs[step]!.join(' · ')}</div> : <div className="mb-3" />}
        {step === 'ed' && <StepEd b={b} up={up} />}
        {step === 'level' && <StepLevel b={b} up={up} />}
        {step === 'class' && <StepClass b={b} up={up} />}
        {step === 'race' && <StepRace b={b} up={up} />}
        {step === 'bg' && <StepBg b={b} up={up} />}
        {step === 'abil' && <StepAbil b={b} up={up} />}
        {step === 'asi' && <StepAsi b={b} up={up} />}
        {step === 'skills' && <StepSkills b={b} up={up} />}
        {step === 'spells' && <StepSpells b={b} up={up} db={db} />}
        {step === 'gear' && <StepGear b={b} up={up} />}
        {step === 'person' && <StepPerson b={b} up={up} />}
        {step === 'done' && <StepDone b={b} db={db} probs={probs} jump={(id) => go(steps.findIndex((s) => s.id === id))} />}
      </main>
      <footer className="fixed inset-x-0 bottom-0 bg-moss-dark/95 backdrop-blur border-t border-moss-light/60 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 z-40">
        <div className="max-w-xl mx-auto px-4 flex gap-2">
          <Btn className="w-14" onClick={() => go(idx - 1)} disabled={idx === 0}><ArrowLeft size={18} /></Btn>
          {step === 'done'
            ? <Btn tone="gold" className="flex-1" disabled={busy || Object.keys(probs).length > 0} onClick={create}><Sparkles size={18} />{Object.keys(probs).length ? 'Не всё выбрано' : busy ? 'Создаю…' : 'Создать лист'}</Btn>
            : <Btn tone="gold" className="flex-1" onClick={() => go(idx + 1)}>Дальше: {steps[idx + 1]?.title}<ArrowRight size={18} /></Btn>}
        </div>
      </footer>
    </div>
  );
}

type P = { b: Build; up: (p: Partial<Build>) => void };
const Card = ({ on, onClick, children, className }: { on?: boolean; onClick?: () => void; children: ReactNode; className?: string }) => (
  <button onClick={onClick} className={cx('text-left rounded-2xl border p-3 transition', on ? 'border-sand bg-sand/15' : 'border-moss-light bg-moss-deep/60', className)}>{children}</button>
);
const Chip = ({ on, onClick, children, disabled }: { on?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean }) => (
  <button disabled={disabled} onClick={onClick} className={cx('h-9 px-3 rounded-full text-sm border transition disabled:opacity-35', on ? 'bg-sand text-moss-deep border-sand font-medium' : 'border-moss-light bg-moss-deep/60 text-cream')}>{children}</button>
);
const H = ({ children }: { children: ReactNode }) => <div className="text-sm text-sand-light mt-5 mb-2">{children}</div>;
const Note = ({ children }: { children: ReactNode }) => <p className="text-sm text-cream/70 leading-snug mb-3">{children}</p>;
const Sel = ({ value, onChange, children, label }: { value: string; onChange: (v: string) => void; children: ReactNode; label?: string }) => (
  <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-moss-deep border border-moss-light text-cream">{children}</select>
);

// ------------------------------------------------------------------ шаги

function StepEd({ b, up }: P) {
  const pick = (ed: Ed) => { if (ed === b.ed) return; up({ ed, race: undefined, sub: undefined, dragon: undefined, raceAsi: [], raceSkills: [], originFeat: undefined, bg: undefined, bgSkills: [], bgAbs: [], bgPlus1: undefined, bgPlus2: undefined, bgFeat: undefined, subclass: undefined, cantrips: [], spells: [], prepared: [], arcanum: [], asi: {}, skills: [], expertise: [] }); };
  return (
    <div className="grid gap-3">
      <Note>По каким правилам играете. Если не знаете — спросите мастера. В клубе чаще играют по 2014.</Note>
      <Card on={b.ed === '2014'} onClick={() => pick('2014')}><div className="font-display-sc text-2xl text-sand-light">2014</div><div className="text-sm text-cream/75">Классическая пятая редакция. Бонусы к характеристикам дают раса и подраса. Заклинания из открытых правил и книг, которые добавил клуб.</div></Card>
      <Card on={b.ed === '2024'} onClick={() => pick('2024')}><div className="font-display-sc text-2xl text-sand-light">2024</div><div className="text-sm text-cream/75">Обновлённые правила. Бонусы к характеристикам и черту происхождения даёт предыстория, у вида их нет. Подкласс у всех с 3 уровня.</div></Card>
    </div>
  );
}

function StepLevel({ b, up }: P) {
  const setL = (level: number) => {
    const asi = Object.fromEntries(Object.entries(b.asi).filter(([l]) => +l <= level));
    up({ level, asi });
  };
  return (
    <>
      <Note>С какого уровня начинаете. Всё дальше считается под него: хиты, бонус мастерства, ячейки, число заклинаний и умения класса.</Note>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((l) => <button key={l} aria-label={`Уровень ${l}`} onClick={() => setL(l)} className={cx('h-14 rounded-xl border font-display-sc text-2xl', b.level === l ? 'bg-sand text-moss-deep border-sand' : 'border-moss-light bg-moss-deep/60 text-cream')}>{l}</button>)}
      </div>
      <div className="text-sm text-cream/70 mt-3">Бонус мастерства на {b.level} уровне: <b className="text-sand-light">{sgn(pb(b.level))}</b></div>
      <H>Хиты за уровни после первого</H>
      <div className="flex gap-2"><Chip on={b.hp === 'avg'} onClick={() => up({ hp: 'avg' })}>Среднее (как в правилах)</Chip><Chip on={b.hp === 'max'} onClick={() => up({ hp: 'max' })}>Максимум (если мастер разрешил)</Chip></div>
    </>
  );
}

function StepClass({ b, up }: P) {
  const c = classOf(b);
  const pick = (id: string) => { if (id === b.cls) return; up({ cls: id, subclass: undefined, customSub: '', style: undefined, skills: [], expertise: [], cantrips: [], spells: [], prepared: [], arcanum: [] }); };
  const ps = packSub(b);
  const at = c ? subAt(c, b.ed, ps) : 99;
  const extra = c ? subsFor(b.ed, c.id) : [];
  const srdName = c ? (b.ed === '2014' ? c.sub.name14 : c.sub.name24) : '';
  const st = c?.style?.[b.ed];
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {classesFor(b.ed).map((x) => (
          <Card key={x.id} on={b.cls === x.id} onClick={() => pick(x.id)}>
            <div className="font-display-sc text-xl text-sand-light leading-tight">{x.name}</div>
            <div className="text-xs text-cream/65 mt-0.5">к{x.hd} · {x.primary}</div>
            <div className="text-[11px] text-cream/50">{x.caster ? (x.caster === 'pact' ? 'магия договора' : x.caster === 'full' ? 'заклинатель' : 'полузаклинатель') : 'без магии'}{x.source ? ` · ${x.source}` : ''}</div>
          </Card>
        ))}
      </div>
      {c && (
        <>
          <H>{c.sub.title}</H>
          {b.level < at ? <Note>{c.sub.title} выбирается на {at} уровне. На {b.level} уровне его ещё нет.</Note> : (
            <div className="grid gap-2">
              {srdName && !extra.some((x) => x.name === srdName) && <Card on={b.subclass === 'srd'} onClick={() => up({ subclass: 'srd' })}><div className="text-cream">{srdName}</div><div className="text-xs text-cream/55">из открытых правил</div></Card>}
              {extra.map((x) => <Card key={x.id} on={b.subclass === x.id} onClick={() => up({ subclass: x.id })}><div className="text-cream">{x.name}{x.level && x.level !== at ? ` (с ${x.level} ур.)` : ''}</div><div className="text-xs text-cream/55">{x.source}{x.summary ? ` · ${x.summary}` : ''}</div></Card>)}
              <Card on={b.subclass === 'custom'} onClick={() => up({ subclass: 'custom' })}><div className="text-cream">Другой (из книги или мастера)</div><div className="text-xs text-cream/55">впишите название сами</div></Card>
              {b.subclass === 'custom' && <TextIn aria-label="Название подкласса" placeholder="Название подкласса" value={b.customSub ?? ''} onChange={(e) => up({ customSub: e.target.value })} />}
            </div>
          )}
          {st && b.level >= st && <><H>Боевой стиль</H><Sel label="Боевой стиль" value={b.style ?? ''} onChange={(v) => up({ style: v || undefined })}><option value="">— выберите —</option>{STYLES.map((s) => <option key={s}>{s}</option>)}</Sel></>}
          <H>Что получит {c.name.toLowerCase()} к {b.level} уровню</H>
          <div className="text-sm text-cream/80 grid gap-1">
            <div><span className="text-cream/55">Хиты:</span> к{c.hd} за уровень · <span className="text-cream/55">Спасброски:</span> {c.saves.map((a) => AB_RU[a]).join(', ')}</div>
            <div><span className="text-cream/55">Доспехи:</span> {c.armor}</div>
            {features(b).map((f) => <div key={f} className="leading-snug">{f}</div>)}
          </div>
          {(featureTexts(b).cls.length > 0 || featureTexts(b).sub.length > 0) && <details className="mt-3"><summary className="text-sm text-sand-light">Описания способностей</summary><div className="text-sm text-cream/80 mt-2 grid gap-1.5">{[...featureTexts(b).cls, ...featureTexts(b).sub].map((t) => <p key={t}>{t}</p>)}</div></details>}
        </>
      )}
    </>
  );
}

function Bonus({ asi }: { asi?: Partial<Record<Ab, number>> }) {
  if (!asi) return null;
  return <span>{Object.entries(asi).map(([a, v]) => `${AB_SHORT[a as Ab]} +${v}`).join(', ')}</span>;
}

function StepRace({ b, up }: P) {
  const r = raceOf(b);
  const pick = (id: string) => { if (id === b.race) return; up({ race: id, sub: undefined, dragon: undefined, raceAsi: [], raceSkills: [], originFeat: undefined }); };
  const fixed = [...fixedSkills({ ...b, raceSkills: [] })];
  return (
    <>
      <Note>{b.ed === '2014' ? 'Раса даёт бонусы к характеристикам, скорость и особенности.' : 'Вид даёт скорость и особенности. Бонусы к характеристикам в 2024 даёт предыстория.'}</Note>
      <div className="grid grid-cols-2 gap-2">
        {racesFor(b.ed).map((x) => (
          <Card key={x.id} on={b.race === x.id} onClick={() => pick(x.id)}>
            <div className="font-display-sc text-xl text-sand-light leading-tight">{x.name}</div>
            <div className="text-xs text-cream/60">{x.speed} фт. {(b.ed === '2014' || x.pack) && x.asi && <>· <Bonus asi={x.asi.str === 1 && x.asi.dex === 1 && !x.pack ? undefined : x.asi} />{x.id === 'human' && !x.pack && 'все +1'}</>}</div>
            {x.source && <div className="text-[11px] text-cream/45">{x.source}</div>}
          </Card>
        ))}
      </div>
      {r && (
        <>
          {r.subs && <><H>{r.subTitle}</H><div className="grid gap-2">{r.subs.map((s) => <Card key={s.id} on={b.sub === s.id} onClick={() => up({ sub: s.id })}><div className="text-cream">{s.name} {s.asi && <span className="text-xs text-cream/55">(<Bonus asi={s.asi} />)</span>}</div><div className="text-xs text-cream/60">{s.traits.map((t) => t.name).join(', ')}{s.source ? ` · ${s.source}` : ''}</div></Card>)}</div></>}
          {r.dragon && <><H>Драконий предок</H><div className="flex flex-wrap gap-2">{DRAGONS.map(([n, t]) => <Chip key={n} on={b.dragon === n} onClick={() => up({ dragon: n })}>{n} · {t}</Chip>)}</div></>}
          {r.asiChoice && <><H>+1 к двум характеристикам на выбор</H><div className="flex flex-wrap gap-2">{ABS.filter((a) => !r.asiChoice!.except?.includes(a)).map((a) => { const on = b.raceAsi.includes(a); return <Chip key={a} on={on} disabled={!on && b.raceAsi.length >= r.asiChoice!.n} onClick={() => up({ raceAsi: on ? b.raceAsi.filter((x) => x !== a) : [...b.raceAsi, a] })}>{AB_RU[a]}</Chip>; })}</div></>}
          {r.skillPick && <><H>Навык{r.skillPick.n > 1 ? 'и' : ''} вида: {r.skillPick.n}</H><div className="flex flex-wrap gap-2">{(r.skillPick.from === 'any' ? ALL_SKILLS : r.skillPick.from).map((s) => { const on = b.raceSkills.includes(s); const taken = fixed.includes(s); return <Chip key={s} on={on} disabled={taken || (!on && b.raceSkills.length >= r.skillPick!.n)} onClick={() => up({ raceSkills: on ? b.raceSkills.filter((x) => x !== s) : [...b.raceSkills, s], skills: b.skills.filter((x) => x !== s) })}>{s}</Chip>; })}</div></>}
          {r.originFeat && <><H>Черта происхождения</H><Sel label="Черта происхождения" value={b.originFeat ?? ''} onChange={(v) => up({ originFeat: v || undefined })}><option value="">— выберите —</option>{ORIGIN_FEATS.map((f) => <option key={f}>{f}</option>)}</Sel></>}
          <H>Особенности</H>
          <div className="grid gap-1.5 text-sm">{[...r.traits, ...(subOf(b)?.traits ?? [])].map((t) => <div key={t.name}><b className="text-cream font-medium">{t.name}.</b> <span className="text-cream/75">{t.text}</span></div>)}</div>
          <div className="text-xs text-cream/55 mt-2">Размер: {r.size} · Языки: {r.langs}</div>
        </>
      )}
    </>
  );
}

function StepBg({ b, up }: P) {
  const bg = bgOf(b);
  const pick = (id: string) => { if (id === b.bg) return; up({ bg: id, bgSkills: [], bgAbs: [], bgPlus1: undefined, bgPlus2: undefined, bgFeat: undefined }); };
  const abs = bg?.custom || !bg?.abs?.length ? ABS : bg.abs;
  return (
    <>
      <Note>{b.ed === '2014' ? 'В открытых правилах 2014 одна предыстория — Прислужник. Любую другую можно собрать как свою: два навыка на выбор.' : 'Предыстория даёт два навыка, инструмент, черту происхождения и бонусы к характеристикам.'}</Note>
      <div className="grid gap-2">{backgroundsFor(b.ed).map((x) => (
        <Card key={x.id} on={b.bg === x.id} onClick={() => pick(x.id)}>
          <div className="font-display-sc text-xl text-sand-light">{x.name}</div>
          {!x.custom && <div className="text-xs text-cream/65">{[x.skills.join(', '), x.skillChoice ? `+${x.skillChoice.choose} навык на выбор` : '', x.tool ?? '', x.feat ? `черта: ${featById(b, x.feat)?.name ?? x.feat}` : '', x.abs?.length ? x.abs.map((a) => AB_SHORT[a]).join('/') : ''].filter(Boolean).join(' · ')}</div>}
          {x.source && <div className="text-[11px] text-cream/45">{x.source}</div>}
        </Card>
      ))}</div>
      {bg?.custom && (
        <>
          <H>Название предыстории</H>
          <TextIn aria-label="Название предыстории" placeholder="Например: Моряк" value={b.bgName ?? ''} onChange={(e) => up({ bgName: e.target.value })} />
          <H>Два навыка</H>
          <div className="flex flex-wrap gap-2">{ALL_SKILLS.map((s) => { const on = b.bgSkills.includes(s); return <Chip key={s} on={on} disabled={!on && b.bgSkills.length >= 2} onClick={() => up({ bgSkills: on ? b.bgSkills.filter((x) => x !== s) : [...b.bgSkills, s], skills: b.skills.filter((x) => x !== s) })}>{s}</Chip>; })}</div>
          {b.ed === '2024' && <><H>Черта происхождения</H><Sel label="Черта предыстории" value={b.bgFeat ?? ''} onChange={(v) => up({ bgFeat: v || undefined })}><option value="">— выберите —</option>{ORIGIN_FEATS.map((f) => <option key={f}>{f}</option>)}</Sel></>}
        </>
      )}
      {bg && b.ed === '2024' && (
        <>
          <H>Бонусы к характеристикам</H>
          <div className="flex gap-2 mb-3"><Chip on={b.bgMode === '21'} onClick={() => up({ bgMode: '21' })}>+2 и +1</Chip><Chip on={b.bgMode === '111'} onClick={() => up({ bgMode: '111' })}>+1, +1, +1</Chip></div>
          {b.bgMode === '21' ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="+2"><Sel label="Плюс два" value={b.bgPlus2 ?? ''} onChange={(v) => up({ bgPlus2: (v || undefined) as Ab })}><option value="">—</option>{abs.map((a) => <option key={a} value={a}>{AB_RU[a]}</option>)}</Sel></Field>
              <Field label="+1"><Sel label="Плюс один" value={b.bgPlus1 ?? ''} onChange={(v) => up({ bgPlus1: (v || undefined) as Ab })}><option value="">—</option>{abs.filter((a) => a !== b.bgPlus2).map((a) => <option key={a} value={a}>{AB_RU[a]}</option>)}</Sel></Field>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">{abs.map((a) => { const on = b.bgAbs.includes(a); return <Chip key={a} on={on} disabled={!on && b.bgAbs.length >= 3} onClick={() => up({ bgAbs: on ? b.bgAbs.filter((x) => x !== a) : [...b.bgAbs, a] })}>{AB_RU[a]}</Chip>; })}</div>
          )}
        </>
      )}
      {bg?.skillChoice && (
        <>
          <H>Навыки на выбор: {b.bgSkills.length} из {bg.skillChoice.choose}</H>
          <div className="flex flex-wrap gap-2">{(bg.skillChoice.from === 'any' ? ALL_SKILLS : bg.skillChoice.from).map((x) => { const on = b.bgSkills.includes(x); return <Chip key={x} on={on} disabled={bg.skills.includes(x) || (!on && b.bgSkills.length >= bg.skillChoice!.choose)} onClick={() => up({ bgSkills: on ? b.bgSkills.filter((y) => y !== x) : [...b.bgSkills, x], skills: b.skills.filter((y) => y !== x) })}>{x}</Chip>; })}</div>
        </>
      )}
      {bg && !bg.custom && (
        <div className="text-sm text-cream/75 mt-4 grid gap-1.5 leading-snug">
          {bg.description && <p>{bg.description}</p>}
          {bg.feature && <p><b className="text-cream font-medium">{bg.feature}.</b> {bg.featureText}</p>}
          {bg.langs && <p className="text-xs text-cream/60">Языки: {bg.langs}</p>}
          <p className="text-xs text-cream/60">Снаряжение: {bg.gear || '—'}</p>
        </div>
      )}
    </>
  );
}

const roll4d6 = () => { const d = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6)).sort((x, y) => y - x); return d[0]! + d[1]! + d[2]!; };

function StepAbil({ b, up }: P) {
  const ob = originBonus(b); const s = scores(b);
  const setBase = (a: Ab, v: number | undefined) => up({ base: { ...b.base, [a]: v } });
  const method = (m: Build['method']) => up({ method: m, base: m === 'pointbuy' ? { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } : { str: undefined, dex: undefined, con: undefined, int: undefined, wis: undefined, cha: undefined } });
  const pool = b.method === 'standard' ? STANDARD : b.rolled;
  const spent = ABS.reduce((t, a) => t + (POINT_COST[b.base[a] ?? 8] ?? 0), 0);
  // значение из набора можно поставить, если таких значений в наборе больше, чем уже занято
  const free = (v: number, a: Ab) => pool.filter((x) => x === v).length > ABS.filter((x) => x !== a && b.base[x] === v).length;
  const auto = () => up({ base: autoAssign(b.method === 'roll' ? b.rolled : STANDARD, b) });
  const canAuto = !!classOf(b) && (b.method !== 'roll' || b.rolled.length > 0) && b.method !== 'manual';
  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Chip on={b.method === 'standard'} onClick={() => method('standard')}>Стандартный набор</Chip>
        <Chip on={b.method === 'pointbuy'} onClick={() => method('pointbuy')}>Покупка очков</Chip>
        <Chip on={b.method === 'roll'} onClick={() => method('roll')}>Броски 4к6</Chip>
        <Chip on={b.method === 'manual'} onClick={() => method('manual')}>Вписать вручную</Chip>
      </div>
      {b.method === 'standard' && <Note>Числа 15, 14, 13, 12, 10, 8 — каждое один раз.</Note>}
      {b.method === 'pointbuy' && <Note>27 очков, значения от 8 до 15. Потрачено: <b className={spent > 27 ? 'text-red-300' : 'text-sand-light'}>{spent}</b> из 27.</Note>}
      {b.method === 'roll' && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <Btn onClick={() => { const rolled = Array.from({ length: 6 }, roll4d6).sort((x, y) => y - x); up({ rolled, base: classOf(b) ? autoAssign(rolled, b) : { str: undefined, dex: undefined, con: undefined, int: undefined, wis: undefined, cha: undefined } }); }}><Dices size={18} />{b.rolled.length ? 'Перебросить' : 'Бросить'}</Btn>
          {b.rolled.length > 0 && <span className="text-sand-light font-display-sc text-xl">{b.rolled.join(' · ')}</span>}
        </div>
      )}
      {b.method === 'manual' && <Note>Если мастер выдал свои значения или вы бросали кубики за столом.</Note>}
      {canAuto && (
        <button type="button" onClick={auto} className="w-full mb-3 rounded-2xl border border-sand/60 bg-sand/10 p-3 text-left">
          <div className="text-sand-light font-semibold inline-flex items-center gap-2"><Sparkles size={17} />Расставить автоматически</div>
          <div className="text-xs text-cream/65 mt-0.5">Самое большое число — в {AB_RU[abilityPriority(b)[0]!].toLowerCase()}, дальше по важности для класса. Потом можно поменять.</div>
        </button>
      )}
      <div className="grid gap-2">
        {ABS.map((a) => (
          <div key={a} className="flex items-center gap-2 rounded-2xl border border-moss-light bg-moss-deep/60 p-2 pl-3">
            <div className="w-28 shrink-0"><div className="text-cream">{AB_RU[a]}</div>{c(b)?.saves.includes(a) && <div className="text-[11px] text-sand-light/80">спасбросок класса</div>}</div>
            <div className="flex-1">
              {(b.method === 'standard' || b.method === 'roll') && (
                <Sel label={AB_RU[a]} value={b.base[a]?.toString() ?? ''} onChange={(v) => setBase(a, v ? +v : undefined)}>
                  <option value="">—</option>{[...new Set(pool)].map((v) => <option key={v} value={v} disabled={!free(v, a) && b.base[a] !== v}>{v}</option>)}
                </Sel>
              )}
              {b.method === 'pointbuy' && (
                <div className="flex items-center gap-2">
                  <Btn className="w-11 px-0" disabled={(b.base[a] ?? 8) <= 8} onClick={() => setBase(a, (b.base[a] ?? 8) - 1)}>−</Btn>
                  <span className="w-8 text-center text-lg">{b.base[a] ?? 8}</span>
                  <Btn className="w-11 px-0" disabled={(b.base[a] ?? 8) >= 15 || spent - (POINT_COST[b.base[a] ?? 8] ?? 0) + (POINT_COST[(b.base[a] ?? 8) + 1] ?? 99) > 27} onClick={() => setBase(a, (b.base[a] ?? 8) + 1)}>+</Btn>
                </div>
              )}
              {b.method === 'manual' && <TextIn aria-label={AB_RU[a]} inputMode="numeric" value={b.base[a]?.toString() ?? ''} onChange={(e) => { const n = parseInt(e.target.value, 10); setBase(a, Number.isNaN(n) ? undefined : Math.max(1, Math.min(30, n))); }} />}
            </div>
            <div className="w-20 text-right shrink-0">
              {ob[a] ? <div className="text-[11px] text-sand-light">+{ob[a]} {b.ed === '2014' ? 'раса' : 'предыст.'}</div> : null}
              <div className="text-xl font-display-sc text-cream leading-none">{s[a]} <span className="text-sm text-cream/60">{sgn(mod(s[a]))}</span></div>
            </div>
          </div>
        ))}
      </div>
      {asiLevels(b).length > 0 && <div className="text-xs text-cream/55 mt-3">Улучшения за уровни добавятся на следующем шаге.</div>}
    </>
  );
}
const c = classOf;

function StepAsi({ b, up }: P) {
  const s = scores(b);
  const set = (l: number, p: Partial<AsiPick>) => up({ asi: { ...b.asi, [l]: { ...{ mode: 'two' as const }, ...b.asi[l], ...p } } });
  return (
    <>
      <Note>На этих уровнях класс даёт увеличение характеристик: +2 к одной или +1 к двум (не выше 20). Вместо этого можно взять черту, если мастер разрешает.</Note>
      <div className="grid gap-3">
        {asiLevels(b).map((l) => {
          const p = b.asi[l] ?? { mode: 'two' as const };
          const epic = b.ed === '2024' && l === 19;
          return (
            <div key={l} className="rounded-2xl border border-moss-light bg-moss-deep/60 p-3">
              <div className="text-sand-light font-display-sc text-lg mb-2">{l} уровень{epic ? ' · эпический дар' : ''}</div>
              {epic ? (
                <div className="grid gap-2">
                  <TextIn aria-label="Эпический дар" placeholder="Название дара" value={p.feat ?? ''} onChange={(e) => set(l, { feat: e.target.value, mode: 'one' })} />
                  <Field label="+1 к характеристике (до 30)"><Sel label="Эпический дар +1" value={p.a ?? ''} onChange={(v) => set(l, { a: (v || undefined) as Ab, mode: 'one' })}><option value="">—</option>{ABS.map((a) => <option key={a} value={a}>{AB_RU[a]}</option>)}</Sel></Field>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-2"><Chip on={p.mode === 'two'} onClick={() => set(l, { mode: 'two' })}>+1 и +1</Chip><Chip on={p.mode === 'one'} onClick={() => set(l, { mode: 'one' })}>+2</Chip><Chip on={p.mode === 'feat'} onClick={() => set(l, { mode: 'feat' })}>Черта</Chip></div>
                  {p.mode === 'feat' ? <FeatPick b={b} l={l} p={p} set={(x) => set(l, x)} /> : (
                    <div className={cx('grid gap-2', p.mode === 'two' && 'grid-cols-2')}>
                      <Sel label={`Улучшение ${l}`} value={p.a ?? ''} onChange={(v) => set(l, { a: (v || undefined) as Ab })}><option value="">—</option>{ABS.map((a) => <option key={a} value={a}>{AB_RU[a]} ({s[a]})</option>)}</Sel>
                      {p.mode === 'two' && <Sel label={`Второе улучшение ${l}`} value={p.b ?? ''} onChange={(v) => set(l, { b: (v || undefined) as Ab })}><option value="">—</option>{ABS.filter((a) => a !== p.a).map((a) => <option key={a} value={a}>{AB_RU[a]} ({s[a]})</option>)}</Sel>}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function FeatPick({ b, l, p, set }: { b: Build; l: number; p: AsiPick; set: (x: Partial<AsiPick>) => void }) {
  const list = featsFor(b.ed);
  const fd = featById(b, p.featId);
  const val = fd ? fd.id : p.featId === '__custom' || p.feat ? '__custom' : '';
  return (
    <div className="grid gap-2">
      <Sel label={`Черта ${l}`} value={val} onChange={(v) => set(v === '__custom' ? { featId: '__custom', featAb: undefined } : { featId: v || undefined, feat: undefined, featAb: undefined })}>
        <option value="">— выберите черту —</option>
        {list.map((f) => { const why = prereqFail(b, f, l); return <option key={f.id} value={f.id} disabled={!!why}>{f.name}{f.prereqText ? ` · ${f.prereqText}` : ''}{why ? ` — ${why}` : ''}</option>; })}
        <option value="__custom">Другая (вписать название)</option>
      </Sel>
      {val === '__custom' && <TextIn aria-label={`Название черты ${l}`} placeholder="Название черты" value={p.feat ?? ''} onChange={(e) => set({ feat: e.target.value, featId: '__custom' })} />}
      {fd && (
        <div className="text-sm text-cream/80 leading-snug grid gap-1">
          <div className="text-xs text-cream/55">{fd.source}{fd.prereqText ? ` · предусловие: ${fd.prereqText}` : ''}{fd.repeatable ? ' · можно брать повторно' : ''}</div>
          <p>{fd.text}</p>
          {fd.benefits.map((x) => <p key={x} className="text-cream/70">• {x}</p>)}
          {fd.asi && <Field label={`+${fd.asi.value} к характеристике`}><Sel label={`Характеристика черты ${l}`} value={p.featAb ?? ''} onChange={(v) => set({ featAb: (v || undefined) as Ab })}><option value="">—</option>{fd.asi.abilities.map((a) => <option key={a} value={a}>{AB_RU[a]}</option>)}</Sel></Field>}
        </div>
      )}
    </div>
  );
}

function StepSkills({ b, up }: P) {
  const cl = classOf(b); if (!cl) return <Note>Сначала выберите класс.</Note>;
  const fixed = fixedSkills(b);
  const from = cl.skills.from === 'any' ? ALL_SKILLS : (b.ed === '2024' && cl.skills.from24) || cl.skills.from;
  const all = allSkills(b); const ex = expertiseCount(b); const s = scores(b); const p = pb(b.level);
  const skilled = feats(b).some((f) => f.startsWith('Одарённый'));
  return (
    <>
      {fixed.length > 0 && <Note>Уже есть от вида и предыстории: <b className="text-cream">{fixed.join(', ')}</b>.</Note>}
      <H>Навыки класса: {b.skills.length} из {cl.skills.n}</H>
      <div className="flex flex-wrap gap-2">{from.map((x) => { const on = b.skills.includes(x); return <Chip key={x} on={on} disabled={fixed.includes(x) || (!on && b.skills.length >= cl.skills.n)} onClick={() => up({ skills: on ? b.skills.filter((y) => y !== x) : [...b.skills, x], expertise: b.expertise.filter((y) => y !== x || !on) })}>{x}</Chip>; })}</div>
      {skilled && <><H>Черта «Одарённый»: {b.skilledFeat.length} из 3</H><div className="flex flex-wrap gap-2">{ALL_SKILLS.map((x) => { const on = b.skilledFeat.includes(x); return <Chip key={x} on={on} disabled={(!on && (b.skilledFeat.length >= 3 || all.includes(x)))} onClick={() => up({ skilledFeat: on ? b.skilledFeat.filter((y) => y !== x) : [...b.skilledFeat, x] })}>{x}</Chip>; })}</div></>}
      {ex > 0 && <><H>Компетентность (двойной бонус): {b.expertise.length} из {ex}</H><div className="flex flex-wrap gap-2">{all.map((x) => { const on = b.expertise.includes(x); return <Chip key={x} on={on} disabled={!on && b.expertise.length >= ex} onClick={() => up({ expertise: on ? b.expertise.filter((y) => y !== x) : [...b.expertise, x] })}>{x}</Chip>; })}</div></>}
    </>
  );
}

function StepSpells({ b, up, db }: P & { db: SpellData[] }) {
  const cl = classOf(b)!; const sr = rule(b)!;
  const [tab, setTab] = useState<'c' | 's' | 'a'>(sr.cantrips ? 'c' : 's');
  const [q, setQ] = useState(''); const [lv, setLv] = useState<number | 'all'>('all'); const [peek, setPeek] = useState<string | null>(null);
  const racial = racialSpells(b, db).map((s) => s.id);
  const listId = cl.spellDef?.list ?? cl.id;
  const pool = useMemo(() => db.filter((s) => s.ed === b.ed && s.cls.includes(listId)), [db, b.ed, listId]);
  const n = q.trim().toLowerCase();
  const list = pool.filter((s) => (tab === 'c' ? s.lvl === 0 : tab === 'a' ? sr.arcanum.includes(s.lvl) : s.lvl >= 1 && s.lvl <= sr.maxLvl) && (lv === 'all' || s.lvl === lv) && (!n || s.name.toLowerCase().includes(n) || (s.ru ?? '').toLowerCase().includes(n)))
    .sort((x, y) => x.lvl - y.lvl || (x.ru ?? x.name).localeCompare(y.ru ?? y.name));
  const key = tab === 'c' ? 'cantrips' : tab === 'a' ? 'arcanum' : 'spells';
  const chosen = b[key]; const lim = tab === 'c' ? sr.cantrips : tab === 'a' ? sr.arcanum.length : sr.spells;
  const toggle = (s: SpellData) => {
    const on = chosen.includes(s.id);
    if (tab === 'a' && !on) { const same = b.arcanum.filter((id) => db.find((x) => x.id === id)?.lvl !== s.lvl); up({ arcanum: [...same, s.id] }); return; }
    up({ [key]: on ? chosen.filter((x) => x !== s.id) : [...chosen, s.id], ...(on && key === 'spells' ? { prepared: b.prepared.filter((x) => x !== s.id) } : {}) } as Partial<Build>);
  };
  const levels = tab === 'c' ? [] : tab === 'a' ? sr.arcanum : Array.from({ length: sr.maxLvl }, (_, i) => i + 1);
  const ab = cl.spellAb!; const sc = scores(b);
  return (
    <>
      <Note>{sr.label}. Ячейки заклинаний: {slots(cl, b.ed, b.level).map((v, i) => (v ? `${i + 1} круг — ${v}` : '')).filter(Boolean).join(', ') || 'пока нет'}.</Note>
      {subSpells(b).length > 0 && <Note>От подкласса, всегда подготовлены: {subSpells(b).join(', ')} — добавятся сами.</Note>}
      {racial.length > 0 && <Note>От вида: {racialSpells(b, db).map((s) => s.ru ?? s.name).join(', ')} — добавятся сами.</Note>}
      <div className="flex gap-2 mb-3 flex-wrap">
        {sr.cantrips > 0 && <Chip on={tab === 'c'} onClick={() => { setTab('c'); setLv('all'); }}>Заговоры {b.cantrips.length}/{sr.cantrips}</Chip>}
        <Chip on={tab === 's'} onClick={() => { setTab('s'); setLv('all'); }}>{sr.book ? 'Книга' : 'Заклинания'} {b.spells.length}/{sr.spells}</Chip>
        {sr.arcanum.length > 0 && <Chip on={tab === 'a'} onClick={() => { setTab('a'); setLv('all'); }}>Арканум {b.arcanum.length}/{sr.arcanum.length}</Chip>}
      </div>
      {sr.book && tab === 's' && <Note>Звёздочкой отметьте подготовленные: {b.prepared.length} из {sr.prepared}.</Note>}
      <div className="relative mb-2"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/50" /><TextIn className="pl-10" aria-label="Поиск заклинания" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название" /></div>
      {levels.length > 1 && <div className="flex gap-1.5 mb-3 flex-wrap"><Chip on={lv === 'all'} onClick={() => setLv('all')}>Все</Chip>{levels.map((l) => <Chip key={l} on={lv === l} onClick={() => setLv(l)}>{l} круг</Chip>)}</div>}
      {!db.length && <Note>База заклинаний загружается…</Note>}
      <div className="grid gap-1.5">
        {list.map((s) => {
          const on = chosen.includes(s.id); const open = peek === s.id; const prep = b.prepared.includes(s.id);
          const full = !on && (tab === 'a' ? false : chosen.length >= lim);
          return (
            <div key={s.id} className={cx('rounded-xl border', on ? 'border-sand bg-sand/15' : 'border-moss-light bg-moss-deep/50')}>
              <div className="flex items-center">
                <button aria-label={`${on ? 'Убрать' : 'Взять'}: ${s.ru ?? s.name}`} disabled={full} onClick={() => toggle(s)} className="p-3 pr-1 disabled:opacity-30"><span className={cx('w-7 h-7 rounded-lg border grid place-items-center', on ? 'bg-sand border-sand text-moss-deep' : 'border-moss-light')}>{on && <Check size={16} />}</span></button>
                <button onClick={() => setPeek(open ? null : s.id)} className="flex-1 min-w-0 text-left py-2.5 pr-2">
                  <span className="block truncate">{s.ru ?? s.name}</span>
                  <span className="text-xs text-cream/55">{s.lvl ? `${s.lvl} круг` : 'заговор'} · {SCHOOLS[s.school] ?? s.school}{s.c ? ' · конц.' : ''}{s.r ? ' · ритуал' : ''}{!/^SRD/.test(s.src) ? ` · ${s.src}` : ''}</span>
                </button>
                {sr.book && tab === 's' && on && <button aria-label={`Подготовить: ${s.ru ?? s.name}`} disabled={!prep && b.prepared.length >= (sr.prepared ?? 0)} onClick={() => up({ prepared: prep ? b.prepared.filter((x) => x !== s.id) : [...b.prepared, s.id] })} className={cx('px-2 text-xl disabled:opacity-30', prep ? 'text-sand-light' : 'text-cream/40')}>{prep ? '★' : '☆'}</button>}
                <ChevronDown size={18} className={cx('mr-3 shrink-0 text-cream/50 transition-transform', open && 'rotate-180')} onClick={() => setPeek(open ? null : s.id)} />
              </div>
              {open && <div className="px-3 pb-3 text-sm text-cream/80 border-t border-moss-light/60 pt-2 grid gap-1">
                <div className="text-xs text-cream/60">{s.rt ?? s.time} · {s.rr ?? s.range} · {s.rd ?? s.dur}{s.cls.length ? ` · ${s.cls.map((x) => CLS_RU[x] ?? x).join(', ')}` : ''}</div>
                <div className="max-h-56 overflow-y-auto whitespace-pre-line leading-relaxed">{(s.rtext ?? s.text ?? '').replace(/\*\*\*?|_/g, '') || 'Описания нет.'}</div>
              </div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function StepGear({ b, up }: P) {
  const cl = classOf(b); if (!cl) return <Note>Сначала выберите класс.</Note>;
  const acWith = (armor?: string, shield = b.shield) => armorClass({ ...b, armor, shield }).ac;
  const atk = attacks(b);
  return (
    <>
      <H><Shield size={15} className="inline -mt-0.5" /> Доспех</H>
      <Note>Можно носить: {cl.armor}.</Note>
      <div className="grid gap-1.5">
        <Card on={!b.armor} onClick={() => up({ armor: undefined })} className="flex justify-between"><span>Без доспеха</span><span className="text-sand-light">КД {acWith(undefined)}</span></Card>
        {ARMORS.filter((a) => armorProf(b).kinds.has(a.kind) || b.armor === a.id).map((a) => { const ok = armorProf(b).kinds.has(a.kind); return (
          <Card key={a.id} on={b.armor === a.id} onClick={() => up({ armor: a.id })} className={cx('flex justify-between items-center', !ok && 'opacity-50')}>
            <span>{a.name} <span className="text-xs text-cream/50">{a.kind === 'light' ? 'лёгкий' : a.kind === 'medium' ? 'средний' : 'тяжёлый'}{!ok && ' · нет владения'}</span></span><span className="text-sand-light">КД {acWith(a.id)}</span>
          </Card>
        ); })}
      </div>
      <label className="flex items-center justify-between mt-3 rounded-2xl border border-moss-light bg-moss-deep/60 p-3"><span>Щит (+2 КД){!armorProf(b).shields && <span className="text-xs text-cream/50"> · нет владения</span>}</span><input type="checkbox" className="w-6 h-6 accent-[#aa9173]" checked={b.shield} onChange={(e) => up({ shield: e.target.checked })} /></label>
      <div className="text-sm text-cream/70 mt-2">Итого КД: <b className="text-sand-light">{armorClass(b).ac}</b> ({armorClass(b).how})</div>
      <H><Swords size={15} className="inline -mt-0.5" /> Оружие (до 4)</H>
      <Note>Вам доступно по стартовому набору: {cl.kit.charAt(0).toLowerCase() + cl.kit.slice(1)}. Ниже — оружие, которым ваш класс владеет.</Note>
      <div className="flex flex-wrap gap-2">{WEAPONS.filter((w) => proficientWeapon(b, w.name) || b.weapons.includes(w.name)).map((w) => { const on = b.weapons.includes(w.name); return <Chip key={w.name} on={on} disabled={!on && b.weapons.length >= 4} onClick={() => up({ weapons: on ? b.weapons.filter((x) => x !== w.name) : [...b.weapons, w.name] })}>{w.name}{!proficientWeapon(b, w.name) && ' *'}</Chip>; })}</div>
      <div className="text-xs text-cream/50 mt-2">Снаряжение предыстории запишется в лист само.</div>
      {atk.length > 0 && <div className="grid gap-1 mt-3 text-sm">{atk.map((a) => <div key={a.name} className="flex justify-between rounded-xl bg-moss-deep/60 border border-moss-light px-3 py-2"><span>{a.name}</span><span className="text-cream/80">{sgn(a.bonus)} · {a.dmg} {a.type}</span></div>)}</div>}
    </>
  );
}

function StepPerson({ b, up }: P) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      <Field label="Имя персонажа"><TextIn value={b.name} onChange={(e) => up({ name: e.target.value })} /></Field>
      <Field label="Игрок"><TextIn value={b.player} onChange={(e) => up({ player: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Мировоззрение"><Sel label="Мировоззрение" value={b.alignment} onChange={(v) => up({ alignment: v })}><option value="">—</option>{ALIGNMENTS.map((a) => <option key={a}>{a}</option>)}</Sel></Field>
        <Field label="Возраст"><TextIn value={b.age} onChange={(e) => up({ age: e.target.value })} /></Field>
      </div>
      <Field label="Внешность"><textarea value={b.appearance} onChange={(e) => up({ appearance: e.target.value })} className="w-full min-h-20 p-3 rounded-xl bg-moss-deep border border-moss-light outline-none" /></Field>
      <Field label="Характер и манеры"><textarea value={b.personality} onChange={(e) => up({ personality: e.target.value })} className="w-full min-h-20 p-3 rounded-xl bg-moss-deep border border-moss-light outline-none" /></Field>
      <Suggest b={b} up={up} />
      <Field label="История персонажа"><textarea value={b.backstory} onChange={(e) => up({ backstory: e.target.value })} className="w-full min-h-28 p-3 rounded-xl bg-moss-deep border border-moss-light outline-none" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Btn onClick={() => up(randomPerson(b))}><Dices size={17} />Случайный вариант</Btn>
        <Btn onClick={async () => setCopied(await copyPrompt(b))}><Sparkles size={17} />Промпт для нейросети</Btn>
      </div>
      {copied === '' && <Note>Промпт скопирован. Вставьте его в ChatGPT или другую нейросеть, а ответ перенесите в поля выше.</Note>}
      {copied && <Field label="Скопируйте промпт и вставьте в нейросеть"><textarea readOnly value={copied} onFocus={(e) => e.currentTarget.select()} className="w-full min-h-40 p-3 rounded-xl bg-moss-deep border border-moss-light outline-none text-sm" /></Field>}
      <div className="text-xs text-cream/50">Всё это можно оставить пустым и дописать потом прямо на листе. «Случайный вариант» заполнит пустые поля, «Промпт» скопирует текст: вставьте его в ChatGPT или другую нейросеть и перенесите ответ сюда.</div>
    </div>
  );
}

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;
const LOOKS = ['Шрам через бровь, взгляд исподлобья', 'Высокий, худой, всегда в потёртом плаще', 'Коренастый, с густой бородой и громким смехом', 'Короткие волосы, татуировка на запястье', 'Аккуратный, в дорогой, но поношенной одежде', 'Веснушки, растрёпанные волосы, вечно в дорожной пыли', 'Бледный, с тёмными кругами под глазами и тихим голосом', 'Крепкие руки в мозолях, шрамы от ожогов'];
const MANNERS = ['Говорит мало и по делу', 'Не может пройти мимо чужой беды', 'Шутит в самый неподходящий момент', 'Всё записывает в потрёпанный дневник', 'Не доверяет магии и тем, кто ей пользуется', 'Любопытен до безрассудства', 'Вежлив со всеми, даже с врагами', 'Вечно торгуется, даже когда не нужно'];
const PASTS = ['Вырос в маленькой деревне, которую сожгли разбойники, и ищет тех, кто это сделал.', 'Служил в городской страже, пока не увидел то, что видеть не следовало.', 'Был учеником мастера, который однажды бесследно исчез, оставив лишь загадочную записку.', 'Задолжал опасным людям и отправился в путь, чтобы раздобыть денег.', 'Потерял память после кораблекрушения и знает о себе только имя.', 'Сбежал из богатой семьи, чтобы самому выбирать свою судьбу.', 'Дал клятву защитить друга детства и до сих пор её держит.', 'Нашёл старую карту с отметкой и хочет узнать, что там спрятано.'];
/** Случайные внешность, характер и история — только в пустые поля. */
function randomPerson(b: Build): Partial<Build> {
  const ch = bgOf(b)?.chars;
  const trait = ch?.personality_traits?.length ? `Черта характера: ${pick(ch.personality_traits)}` : pick(MANNERS);
  return {
    ...(b.alignment ? {} : { alignment: pick(ALIGNMENTS) }),
    ...(b.appearance.trim() ? {} : { appearance: pick(LOOKS) }),
    ...(b.personality.trim() ? {} : { personality: trait }),
    ...(b.backstory.trim() ? {} : { backstory: pick(PASTS) }),
  };
}
/** Промпт для нейросети: класс, вид, предыстория — придумай личность. */
async function copyPrompt(b: Build): Promise<string> {
  const text = `Придумай персонажа для настольной ролевой игры D&D 5e (редакция ${b.ed}). ${[classOf(b)?.name && `Класс: ${classOf(b)!.name}${b.level ? `, ${b.level} уровень` : ''}`, raceOf(b)?.name && `Вид: ${raceOf(b)!.name}`, bgOf(b)?.name && `Предыстория: ${bgOf(b)!.name}`, b.name && `Имя: ${b.name}`, b.alignment && `Мировоззрение: ${b.alignment}`].filter(Boolean).join('. ')}.
Напиши коротко и по-русски, четырьмя блоками:
1. Внешность — 2–3 предложения.
2. Характер и манеры — 3–4 черты.
3. История персонажа — один абзац, 5–7 предложений, с одной неразгаданной загадкой из прошлого.
4. Цель — чего персонаж хочет добиться.`;
  try { await navigator.clipboard.writeText(text); return ''; } catch { return text; }
}

function Suggest({ b, up }: P) {
  const ch = bgOf(b)?.chars; if (!ch) return null;
  const groups: [string, string[] | undefined][] = [['Черты характера', ch.personality_traits], ['Идеалы', ch.ideals], ['Привязанности', ch.bonds], ['Слабости', ch.flaws]];
  return (
    <details className="rounded-2xl border border-moss-light p-3"><summary className="text-sm text-sand-light">Подсказки из предыстории — нажмите строку, чтобы добавить</summary>
      {groups.filter(([, v]) => v?.length).map(([t, v]) => (
        <div key={t} className="mt-2"><div className="text-xs text-cream/55 mb-1">{t}</div>
          <div className="grid gap-1">{v!.map((x) => <button key={x} onClick={() => up({ personality: (b.personality ? `${b.personality}\n` : '') + `${t.slice(0, -1)}: ${x}` })} className="text-left text-sm text-cream/85 rounded-lg bg-moss-deep/60 border border-moss-light/60 px-2 py-1.5">{x}</button>)}</div>
        </div>
      ))}
    </details>
  );
}

function StepDone({ b, db, probs, jump }: { b: Build; db: SpellData[]; probs: Record<string, string[]>; jump: (id: StepId) => void }) {
  const cl = classOf(b); const r = raceOf(b); const bg = bgOf(b);
  if (!cl || !r || !bg) return <Note>Сначала выберите класс, вид и предысторию.</Note>;
  const s = scores(b); const p = pb(b.level); const ac = armorClass(b); const sk = allSkills(b);
  const names = (ids: string[]) => ids.map((id) => db.find((x) => x.id === id)).filter(Boolean).map((x) => x!.ru ?? x!.name);
  const keys = Object.keys(probs) as StepId[];
  return (
    <>
      {keys.length > 0 && (
        <div className="rounded-2xl border border-amber-300/50 bg-amber-300/10 p-3 mb-4">
          <div className="text-amber-200 mb-1">Осталось выбрать:</div>
          {keys.map((k) => <button key={k} onClick={() => jump(k)} className="block text-left text-sm text-cream/85 underline underline-offset-2 py-0.5">{STEPS.find((x) => x.id === k)?.title}: {probs[k]!.join(', ')}</button>)}
        </div>
      )}
      <div className="rounded-3xl border border-sand/60 bg-moss-dark p-4">
        <div className="font-display-sc text-2xl text-sand-light leading-tight">{b.name || 'Без имени'}</div>
        <div className="text-sm text-cream/75">{subOf(b)?.name ?? r.name} · {cl.name}{subName(b) ? ` (${subName(b)})` : ''} · {b.level} уровень · {bg.custom ? b.bgName || 'своя предыстория' : bg.name} · правила {b.ed}</div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {ABS.map((a) => <div key={a} className="rounded-xl bg-moss-deep border border-moss-light text-center py-2"><div className="text-[11px] text-cream/60">{AB_SHORT[a]}</div><div className="font-display-sc text-2xl text-cream leading-none">{s[a]}</div><div className="text-xs text-sand-light">{sgn(mod(s[a]))}</div></div>)}
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2 text-center">
          {[['Хиты', maxHp(b)], ['КД', ac.ac], ['Скорость', speed(b)], ['Мастерство', sgn(p)]].map(([l, v]) => <div key={l} className="rounded-xl bg-moss-deep border border-moss-light py-2"><div className="text-[11px] text-cream/60">{l}</div><div className="text-lg text-cream">{v}</div></div>)}
        </div>
        <div className="text-sm mt-3 grid gap-1.5 text-cream/85">
          <div><span className="text-cream/55">Спасброски:</span> {saves(b).map((a) => `${AB_RU[a]} ${sgn(mod(s[a]) + p)}`).join(', ')}</div>
          <div><span className="text-cream/55">Навыки:</span> {sk.map((x) => (b.expertise.includes(x) ? `${x} (комп.)` : x)).join(', ') || '—'}</div>
          <div><span className="text-cream/55">Атаки:</span> {attacks(b).map((a) => `${a.name} ${sgn(a.bonus)}, ${a.dmg}`).join('; ') || '—'}</div>
          {rule(b) && <div><span className="text-cream/55">Заклинания:</span> {[...names(b.cantrips), ...names(b.spells), ...names(b.arcanum), ...racialSpells(b, db).map((x) => x.ru ?? x.name)].join(', ') || '—'}</div>}
          {feats(b).length > 0 && <div><span className="text-cream/55">Черты:</span> {feats(b).join(', ')}</div>}
        </div>
        <details className="mt-3"><summary className="text-sm text-sand-light">Умения класса по уровням</summary><div className="text-sm text-cream/80 mt-2 grid gap-1">{features(b).map((f) => <div key={f}>{f}</div>)}</div></details>
      </div>
      <p className="text-sm text-cream/70 mt-4 leading-snug">Кнопка «Создать лист» соберёт всё это в лист клуба и откроет его. Там можно дописать детали, распечатать и играть.</p>
      <Btn tone="ghost" className="mt-2" onClick={() => { if (confirm('Начать сборку заново? Текущие выборы сотрутся.')) { localStorage.removeItem(DRAFT); location.reload(); } }}><RotateCcw size={16} />Начать заново</Btn>
    </>
  );
}
