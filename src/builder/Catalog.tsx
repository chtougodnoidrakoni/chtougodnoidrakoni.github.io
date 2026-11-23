import { useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Btn, Field, Sheet as Panel, TextIn } from '../Panels';
import { ALL_SKILLS, AB_RU, ABS, type Ab, type Ed } from './data';
import { backgroundsFor, featsFor, rawBg, rawFeat, saveCustom, type BackgroundIn, type FeatIn, type StoredPack } from './content';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');
const AB_EN: Record<Ab, string> = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50);
const lines = (s: string) => s.split(/\n|;/).map((x) => x.trim()).filter(Boolean);

/** Разделы «Черты» и «Предыстории»: список, фильтры по источнику и предусловию, добавление и правка. */
export function Catalog({ onChange }: { onChange: (l: StoredPack[]) => void }) {
  const [ed, setEd] = useState<Ed>('2014');
  const [tab, setTab] = useState<'feats' | 'bgs'>('feats');
  const [src, setSrc] = useState('');
  const [pre, setPre] = useState<'all' | 'yes' | 'no'>('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<FeatIn | BackgroundIn | null>(null);
  const feats = featsFor(ed); const bgs = backgroundsFor(ed).filter((x) => !x.custom);
  const items = tab === 'feats' ? feats : bgs;
  const sources = useMemo(() => [...new Set(items.map((x) => x.source ?? 'Встроено'))], [items]);
  const n = q.trim().toLowerCase();
  const shown = tab === 'feats'
    ? feats.filter((f) => (!src || f.source === src) && (pre === 'all' || (pre === 'yes') === (f.prereq.length > 0 || !!f.prereqText)) && (!n || f.name.toLowerCase().includes(n) || (f.nameEn ?? '').toLowerCase().includes(n)))
    : bgs.filter((g) => (!src || (g.source ?? 'Встроено') === src) && (!n || g.name.toLowerCase().includes(n)));
  const openNew = () => setEdit(tab === 'feats' ? { id: '', name: '', name_en: '', source: '', description: '', prerequisites: [] } : { id: '', name: '', name_en: '', source: '', description: '', skill_proficiencies: [] });
  const openEdit = (id: string) => {
    if (tab === 'feats') { const f = rawFeat(ed, id) ?? (() => { const d = feats.find((x) => x.id === id)!; return { id: d.id, name: d.name, name_en: d.nameEn ?? d.name, source: d.source, description: d.text, prerequisite: d.prereqText ?? null, prerequisites: d.prereq, repeatable: d.repeatable, asi_included: !!d.asi, asi_choice: d.asi ? { abilities: d.asi.abilities.map((a) => AB_EN[a]), value: d.asi.value } : undefined } as FeatIn; })(); setEdit(JSON.parse(JSON.stringify(f))); }
    else { const g = rawBg(ed, id) ?? (() => { const d = bgs.find((x) => x.id === id)!; return { id: d.id, name: d.name, name_en: d.name, source: d.source ?? (ed === '2014' ? 'SRD 5.1' : 'SRD 5.2'), description: d.description ?? '', skill_proficiencies: d.skills, tool_proficiencies: d.tool ? [d.tool] : [], languages: d.langs ? [d.langs] : [], equipment: d.gear ? lines(d.gear.replace(/, /g, ';')) : [], feature: d.feature ? { name: d.feature, description: d.featureText ?? '' } : undefined } as BackgroundIn; })(); setEdit(JSON.parse(JSON.stringify(g))); }
  };
  return (
    <div className="mt-6">
      <div className="flex gap-2 flex-wrap mb-2">
        <Btn className={cx('h-9 text-sm', tab === 'feats' && '!bg-sand !text-moss-deep')} onClick={() => { setTab('feats'); setSrc(''); }}>Черты</Btn>
        <Btn className={cx('h-9 text-sm', tab === 'bgs' && '!bg-sand !text-moss-deep')} onClick={() => { setTab('bgs'); setSrc(''); }}>Предыстории</Btn>
        <select aria-label="Редакция каталога" value={ed} onChange={(e) => { setEd(e.target.value as Ed); setSrc(''); }} className="h-9 px-2 rounded-xl bg-moss-deep border border-moss-light text-sm"><option value="2014">2014</option><option value="2024">2024</option></select>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <select aria-label="Источник" value={src} onChange={(e) => setSrc(e.target.value)} className="h-10 px-2 rounded-xl bg-moss-deep border border-moss-light text-sm"><option value="">Все источники</option>{sources.map((x) => <option key={x}>{x}</option>)}</select>
        {tab === 'feats' ? <select aria-label="Предусловие" value={pre} onChange={(e) => setPre(e.target.value as 'all')} className="h-10 px-2 rounded-xl bg-moss-deep border border-moss-light text-sm"><option value="all">Любое предусловие</option><option value="no">Без предусловия</option><option value="yes">С предусловием</option></select> : <span />}
      </div>
      <div className="flex gap-2 mb-2"><TextIn aria-label="Поиск по каталогу" placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} /><Btn tone="gold" onClick={openNew}><Plus size={16} />Добавить</Btn></div>
      <div className="grid gap-1.5">
        {shown.map((x) => (
          <div key={x.id} className="rounded-xl border border-moss-light bg-moss-deep/60 px-3 py-2 flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-cream">{x.name}</div>
              <div className="text-xs text-cream/55">{x.source ?? 'Встроено'}{'prereqText' in x && x.prereqText ? ` · ${x.prereqText}` : ''}{'skills' in x && x.skills.length ? ` · ${x.skills.join(', ')}` : ''}</div>
            </div>
            <button aria-label={`Редактировать: ${x.name}`} onClick={() => openEdit(x.id)} className="p-1.5 text-sand-light"><Pencil size={16} /></button>
          </div>
        ))}
        {!shown.length && <div className="text-sm text-cream/50">Ничего не найдено.</div>}
      </div>
      <Editor ed={ed} kind={tab} item={edit} onClose={() => setEdit(null)} onSaved={(l) => { onChange(l); setEdit(null); }} />
    </div>
  );
}

function Editor({ ed, kind, item, onClose, onSaved }: { ed: Ed; kind: 'feats' | 'bgs'; item: FeatIn | BackgroundIn | null; onClose: () => void; onSaved: (l: StoredPack[]) => void }) {
  const [d, setD] = useState<Record<string, unknown>>({});
  const [err, setErr] = useState('');
  const [key, setKey] = useState<unknown>(null);
  if (item !== key) { setKey(item); setD(item ? { ...item } : {}); setErr(''); }
  const v = (k: string) => (d[k] as string | undefined) ?? '';
  const set = (p: Record<string, unknown>) => setD({ ...d, ...p });
  const f = d as unknown as FeatIn; const g = d as unknown as BackgroundIn;
  const ab = f.prerequisites?.find((x) => x.type === 'ability') as { ability: string; min: number } | undefined;
  const save = async () => {
    const out = { ...d, id: v('id') || slug(v('name_en')) || `item_${Date.now()}` } as unknown as FeatIn & BackgroundIn;
    try { onSaved(await saveCustom(ed, kind === 'feats' ? 'feats' : 'backgrounds', out)); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <Panel open={!!item} onClose={onClose} title={item?.id ? 'Редактировать' : kind === 'feats' ? 'Новая черта' : 'Новая предыстория'} footer={<div className="pb-1"><Btn tone="gold" className="w-full" onClick={save}>Сохранить</Btn>{err && <div className="text-xs text-red-300 mt-1">{err}</div>}</div>}>
      <div className="grid gap-2 pb-2">
        <div className="text-xs text-cream/55">Сохраняется в пакет «Мои записи ({ed})» на этом телефоне. Встроенные и чужие записи не меняются — ваша версия просто становится главной.</div>
        <Field label="Название (рус.)"><TextIn value={v('name')} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Название (англ.)"><TextIn value={v('name_en')} onChange={(e) => set({ name_en: e.target.value })} /></Field>
        <Field label="Источник"><TextIn value={v('source')} onChange={(e) => set({ source: e.target.value })} /></Field>
        {kind === 'feats' ? (
          <>
            <Field label="Предусловие текстом (пусто — нет)"><TextIn value={(f.prerequisite as string) ?? ''} onChange={(e) => set({ prerequisite: e.target.value || null })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Проверять характеристику"><select value={ab ? Object.entries(AB_EN).find(([, x]) => x === ab.ability)?.[0] ?? '' : ''} onChange={(e) => { const rest = (f.prerequisites ?? []).filter((x) => x.type !== 'ability'); set({ prerequisites: e.target.value ? [...rest, { type: 'ability', ability: AB_EN[e.target.value as Ab], min: ab?.min ?? 13 }] : rest }); }} className="w-full h-11 px-2 rounded-xl bg-moss-deep border border-moss-light"><option value="">нет</option>{ABS.map((a) => <option key={a} value={a}>{AB_RU[a]}</option>)}</select></Field>
              <Field label="Не ниже"><TextIn inputMode="numeric" value={ab ? String(ab.min) : ''} onChange={(e) => set({ prerequisites: (f.prerequisites ?? []).map((x) => (x.type === 'ability' ? { ...x, min: parseInt(e.target.value, 10) || 13 } : x)) })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="w-5 h-5 accent-[#aa9173]" checked={(f.prerequisites ?? []).some((x) => x.type === 'spellcasting')} onChange={(e) => set({ prerequisites: e.target.checked ? [...(f.prerequisites ?? []), { type: 'spellcasting' }] : (f.prerequisites ?? []).filter((x) => x.type !== 'spellcasting') })} />Нужно уметь колдовать</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="w-5 h-5 accent-[#aa9173]" checked={!!f.repeatable} onChange={(e) => set({ repeatable: e.target.checked })} />Можно брать повторно</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="w-5 h-5 accent-[#aa9173]" checked={!!f.asi_included} onChange={(e) => set({ asi_included: e.target.checked, asi_choice: e.target.checked ? f.asi_choice ?? { abilities: [], value: 1 } : undefined })} />Даёт +1 к характеристике</label>
            {f.asi_included && <div className="flex flex-wrap gap-2">{ABS.map((a) => { const on = f.asi_choice?.abilities.includes(AB_EN[a]); return <button key={a} onClick={() => set({ asi_choice: { value: 1, abilities: on ? f.asi_choice!.abilities.filter((x) => x !== AB_EN[a]) : [...(f.asi_choice?.abilities ?? []), AB_EN[a]] } })} className={cx('h-8 px-3 rounded-full text-sm border', on ? 'bg-sand text-moss-deep border-sand' : 'border-moss-light')}>{AB_RU[a]}</button>; })}</div>}
          </>
        ) : (
          <>
            <div className="text-xs text-cream/60 px-1">Навыки</div>
            <div className="flex flex-wrap gap-1.5">{ALL_SKILLS.map((s) => { const on = g.skill_proficiencies?.includes(s); return <button key={s} onClick={() => set({ skill_proficiencies: on ? g.skill_proficiencies!.filter((x) => x !== s) : [...(g.skill_proficiencies ?? []), s] })} className={cx('h-8 px-2.5 rounded-full text-xs border', on ? 'bg-sand text-moss-deep border-sand' : 'border-moss-light')}>{s}</button>; })}</div>
            <Field label="Инструменты (через ;)"><TextIn value={(g.tool_proficiencies ?? []).join('; ')} onChange={(e) => set({ tool_proficiencies: lines(e.target.value) })} /></Field>
            <Field label="Языки (через ;)"><TextIn value={(g.languages ?? []).join('; ')} onChange={(e) => set({ languages: lines(e.target.value) })} /></Field>
            <Field label="Снаряжение (каждый предмет с новой строки)"><textarea value={(g.equipment ?? []).join('\n')} onChange={(e) => set({ equipment: lines(e.target.value) })} className="w-full min-h-20 p-3 rounded-xl bg-moss-deep border border-moss-light outline-none text-sm" /></Field>
            <Field label="Умение предыстории"><TextIn value={g.feature?.name ?? ''} onChange={(e) => set({ feature: { ...g.feature, name: e.target.value } })} /></Field>
            <Field label="Описание умения"><textarea value={g.feature?.description ?? ''} onChange={(e) => set({ feature: { name: g.feature?.name ?? '', ...g.feature, description: e.target.value } })} className="w-full min-h-16 p-3 rounded-xl bg-moss-deep border border-moss-light outline-none text-sm" /></Field>
          </>
        )}
        <Field label="Описание"><textarea value={v('description')} onChange={(e) => set({ description: e.target.value })} className="w-full min-h-28 p-3 rounded-xl bg-moss-deep border border-moss-light outline-none text-sm" /></Field>
      </div>
    </Panel>
  );
}
