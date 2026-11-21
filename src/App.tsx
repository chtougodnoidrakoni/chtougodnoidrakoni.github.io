import { useEffect, useState } from 'react';
import { ArrowLeft, Undo2, Redo2, Settings2, Printer, Download, Plus, Pencil, Check, Trash2, Copy, ChevronUp, ChevronDown, Upload, FilePlus2, MoreHorizontal, LayoutTemplate } from 'lucide-react';
import { useStore } from './store';
import { makeBlock, PAGE_TEMPLATES, relayoutFromTemplate, uid, type BlockType, type Sheet } from './model';
import { LayoutPage, SpellbookPages } from './Page';
import { findFree } from './layout';
import { FillModal } from './Fill';
import { AddBlockPanel, Btn, Inspector, Sheet as Panel, SettingsPanel, SpellPicker, TextIn } from './Panels';

declare const __BUILD__: string;
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

async function saveFile(name: string, blob: Blob) {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) { try { await nav.share({ files: [file] }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
}

/**
 * Масштаб листа под ширину экрана.
 * Берём clientWidth, а не innerWidth: в Safari innerWidth меняется при увеличении пальцами,
 * и лист пересчитывался прямо во время зума — всё уезжало.
 */
function useScale() {
  const calc = () => Math.min(document.documentElement.clientWidth - 20, 820) / 210;
  const [s, setS] = useState(calc);
  useEffect(() => {
    const f = () => { const n = calc(); setS((o) => (Math.abs(o - n) > 0.01 ? n : o)); };
    window.addEventListener('orientationchange', f); window.addEventListener('resize', f);
    return () => { window.removeEventListener('orientationchange', f); window.removeEventListener('resize', f); };
  }, []);
  return s;
}

export function App() {
  const { ready, sheet, boot, open, toast } = useStore();
  useEffect(() => {
    void boot().then(() => { const m = location.hash.match(/sheet\/(\w+)/); if (m) void open(m[1]!); });
  }, [boot, open]);
  if (!ready) return <div className="h-screen grid place-items-center text-sand">…</div>;
  return (
    <>
      {sheet ? <Editor /> : <Home />}
      {toast && <div className="fixed top-0 inset-x-0 z-[70] flex justify-center pt-16 pointer-events-none no-print"><div className="px-4 py-3 rounded-xl bg-moss border border-sand/50 text-sm shadow-xl">{toast}</div></div>}
    </>
  );
}

function Home() {
  const { index, create, open, remove, say } = useStore();
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <div className="max-w-xl mx-auto px-4 pb-16">
      <header className="safe-top pt-6 pb-4 flex items-center gap-4">
        <img src={`${import.meta.env.BASE_URL}icons/club-emblem.png`} alt="" className="w-16 h-16" />
        <div><div className="font-display-sc text-3xl text-sand-light leading-none">Лист персонажа</div><div className="text-sm text-cream/60 mt-1">клуб «Что угодно и драконы»</div><div className="text-xs text-cream/50 mt-1">Разработано inst: <a href="https://instagram.com/zamir.digital" target="_blank" rel="noopener" className="text-sand-light underline underline-offset-2">zamir.digital</a></div></div>
      </header>
      <div className="grid gap-2">
        <Btn tone="gold" className="h-14 text-lg" onClick={async () => open(await create())}><FilePlus2 />Новый лист по шаблону клуба</Btn>
        <label className="h-11 rounded-xl bg-moss border border-moss-light inline-flex items-center justify-center gap-2 cursor-pointer"><Upload size={18} />Открыть файл листа (.json)
          <input type="file" accept=".json,application/json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try {
              const s = JSON.parse(await f.text()) as Sheet;
              if (!Array.isArray(s.pages) || !Array.isArray(s.spells)) throw new Error();
              void open(await create(s)); say('Лист открыт');
            } catch { say('Это не файл листа'); }
            e.target.value = '';
          }} />
        </label>
      </div>
      <div className="mt-6 grid gap-2">
        {index.map((m) => (
          <div key={m.id} className="flex items-center gap-2 p-4 rounded-2xl bg-moss/70 border border-moss-light">
            <button className="flex-1 text-left" onClick={() => open(m.id)}>
              <div className="font-display-sc text-xl text-cream">{m.name || 'Без названия'}</div>
              <div className="text-xs text-cream/50">изменён {new Date(m.updatedAt).toLocaleString()}</div>
            </button>
            {confirm === m.id
              ? <Btn tone="danger" onClick={async () => { await remove(m.id); setConfirm(null); }}>Удалить?</Btn>
              : <button className="w-10 h-10 grid place-items-center text-cream/60" onClick={() => setConfirm(m.id)}><Trash2 size={18} /></button>}
          </div>
        ))}
        {!index.length && <p className="text-center text-cream/50 text-sm mt-6">Здесь будут ваши листы. Всё хранится на этом телефоне.</p>}
      </div>
      <p className="text-xs text-cream/40 mt-10 leading-relaxed">Описания заклинаний — из System Reference Document 5.1 и 5.2 (Wizards of the Coast, CC-BY-4.0). Неофициальный проект, не связан с Wizards of the Coast.</p>
    </div>
  );
}

function Editor() {
  const st = useStore();
  const { sheet, editPage, setEditPage, undo, redo, past, future, close, commit, selected, pageIdx, setPage, create, open, say } = st;
  const scale = useScale();
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const [addBlock, setAddBlock] = useState(false);
  const [addPage, setAddPage] = useState(false);
  const [pageMenu, setPageMenu] = useState<number | null>(null);
  if (!sheet) return null;
  let num = 1;

  const insertBlock = (t: BlockType) => {
    const b = makeBlock(t);
    const ei = sheet.pages.findIndex((p) => p.id === editPage);
    const target = ei >= 0 ? ei : sheet.pages[pageIdx]?.kind === 'layout' ? pageIdx : sheet.pages.findIndex((p) => p.kind === 'layout');
    if (target < 0) return say('Сначала добавьте обычную страницу');
    const free = findFree(sheet.pages[target]!.blocks, b.w, b.h);
    if (!free) return say('На странице нет свободного места. Выделите блок и нажмите «Разделить», или добавьте новую страницу');
    Object.assign(b, free);
    commit((s) => ({ ...s, pages: s.pages.map((p, i) => (i === target ? { ...p, blocks: [...p.blocks, b] } : p)) }));
    setEditPage(sheet.pages[target]!.id); useStore.getState().select(b.id);
    setPage(target);
    document.getElementById(`page-${sheet.pages[target]!.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const movePage = (i: number, d: -1 | 1) => commit((s) => { const p = [...s.pages]; const [x] = p.splice(i, 1); p.splice(Math.max(0, Math.min(p.length, i + d)), 0, x!); return { ...s, pages: p }; });

  return (
    <div className={cx('editor-root min-h-screen', selected ? 'pb-[48vh]' : 'pb-28')}>
      <header className="sticky top-0 z-30 safe-top bg-moss-deep/95 backdrop-blur border-b border-moss-light/60 no-print">
        <div className="max-w-3xl mx-auto px-2 h-14 flex items-center gap-1">
          <button className="w-11 h-11 grid place-items-center text-sand-light" onClick={close} aria-label="Назад"><ArrowLeft /></button>
          <div className="flex-1 min-w-0 font-display-sc text-xl truncate">{sheet.name}</div>
          <button className="w-10 h-10 grid place-items-center disabled:opacity-30" disabled={!past.length} onClick={undo} aria-label="Отменить"><Undo2 size={20} /></button>
          <button className="w-10 h-10 grid place-items-center disabled:opacity-30" disabled={!future.length} onClick={redo} aria-label="Повторить"><Redo2 size={20} /></button>
          <button className="w-11 h-11 grid place-items-center text-sand-light" onClick={() => setMenu(true)} aria-label="Меню"><MoreHorizontal /></button>
        </div>
      </header>

      <main className="pt-3">
        {sheet.pages.map((p, i) => {
          const header = (
            <div className="no-print max-w-[820px] mx-auto px-3 flex items-center gap-2 text-sm text-cream/70 mb-1.5">
              <span className="font-display-sc text-base text-sand-light truncate">{p.title}</span>
              <span className="flex-1" />
              {p.kind === 'layout' && (editPage === p.id
                ? <button className="h-9 px-4 rounded-full bg-gradient-to-b from-sand-light to-sand text-moss-deep font-semibold inline-flex items-center gap-1.5" onClick={() => setEditPage(undefined)}><Check size={16} />Готово</button>
                : <button className="h-9 px-3 rounded-full bg-moss border border-moss-light text-cream inline-flex items-center gap-1.5" onClick={() => { setEditPage(p.id); setPage(i); }} aria-label={`Изменить страницу ${p.title}`}><Pencil size={15} />Изменить</button>)}
              <button className="w-9 h-9 grid place-items-center" onClick={() => setPageMenu(i)} aria-label="Страница"><MoreHorizontal size={18} /></button>
            </div>
          );
          if (p.kind === 'spellbook') {
            const start = num; num += 1;
            return <section key={p.id} id={`page-${p.id}`} className="page-wrap pt-3">{header}<SpellbookPages page={p} sheet={sheet} scale={scale} startNum={start} /></section>;
          }
          const n = num++;
          return <section key={p.id} id={`page-${p.id}`} className="page-wrap py-3" onPointerDown={() => pageIdx !== i && setPage(i)}>{header}{editPage === p.id && !selected && <div className="no-print max-w-[820px] mx-auto px-4 pb-2 text-xs text-cream/60">Нажмите на блок, чтобы выделить. Оранжевые ручки справа и снизу увеличивают блок за счёт соседа. Разделить или удалить — в панели блока.</div>}<LayoutPage page={p} pageIndex={i} sheet={sheet} scale={scale} num={n} /></section>;
        })}
      </main>

      {!selected && (
        <div className="fixed bottom-0 inset-x-0 z-30 no-print safe-bottom bg-gradient-to-t from-moss-deep via-moss-deep/90 to-transparent pt-6">
          <div className="max-w-xl mx-auto px-4 flex gap-2">
            <Btn className="flex-1" onClick={() => setAddPage(true)}><Plus size={18} />Страница</Btn>
            <Btn className="flex-1" onClick={() => setAddBlock(true)}><LayoutTemplate size={18} />Блок</Btn>
            <Btn tone="gold" className="flex-1" onClick={() => window.print()}><Printer size={18} />PDF</Btn>
          </div>
        </div>
      )}

      <Inspector />
      <FillModal />
      <SpellPicker />
      <SettingsPanel open={settings} onClose={() => setSettings(false)} />
      <AddBlockPanel open={addBlock} onClose={() => setAddBlock(false)} onAdd={insertBlock} />

      <Panel open={addPage} onClose={() => setAddPage(false)} title="Новая страница">
        <div className="grid grid-cols-2 gap-2 pb-2">
          {PAGE_TEMPLATES.map((t) => <Btn key={t.name} className="h-14" onClick={() => { const pg = t.make(); commit((s) => ({ ...s, pages: [...s.pages, pg] })); setAddPage(false); setTimeout(() => document.getElementById(`page-${pg.id}`)?.scrollIntoView({ behavior: 'smooth' }), 100); }}>{t.name}</Btn>)}
        </div>
      </Panel>

      <Panel open={pageMenu !== null} onClose={() => setPageMenu(null)} title={pageMenu !== null ? sheet.pages[pageMenu]?.title : ''}>
        {pageMenu !== null && sheet.pages[pageMenu] && (
          <div className="grid gap-2 pb-2">
            <TextIn value={sheet.pages[pageMenu]!.title} onChange={(e) => { const v = e.target.value; commit((s) => ({ ...s, pages: s.pages.map((p, i) => (i === pageMenu ? { ...p, title: v, blocks: p.blocks.map((b, k) => (k === 0 && b.type === 'title' && b.label === p.title ? { ...b, label: v } : b)) } : p)) })); }} />
            <div className="grid grid-cols-2 gap-2">
              <Btn disabled={pageMenu === 0} onClick={() => { movePage(pageMenu, -1); setPageMenu(pageMenu - 1); }}><ChevronUp size={18} />Выше</Btn>
              <Btn disabled={pageMenu === sheet.pages.length - 1} onClick={() => { movePage(pageMenu, 1); setPageMenu(pageMenu + 1); }}><ChevronDown size={18} />Ниже</Btn>
            </div>
            {sheet.pages[pageMenu]!.kind === 'layout' && <Btn onClick={() => {
              const r = relayoutFromTemplate(sheet.pages[pageMenu]!, findFree);
              if (!r) { say('Для этой страницы нет шаблона'); return; }
              commit((s) => ({ ...s, pages: s.pages.map((p, i) => (i === pageMenu ? r.page : p)) }));
              setPageMenu(null);
              say(r.dropped ? `Разметка обновлена. ${r.dropped} своих блоков не поместились — вернуть: «отменить»` : 'Разметка как в шаблоне, всё вписанное на месте');
            }}><LayoutTemplate size={18} />Разметка как в шаблоне</Btn>}
            <Btn onClick={() => { const src = sheet.pages[pageMenu]!; const copy = { ...structuredClone(src), id: uid(), title: `${src.title} (копия)`, blocks: src.blocks.map((b) => ({ ...b, id: uid() })) }; commit((s) => { const p = [...s.pages]; p.splice(pageMenu + 1, 0, copy); return { ...s, pages: p }; }); setPageMenu(null); }}><Copy size={18} />Копия страницы</Btn>
            <Btn tone="danger" disabled={sheet.pages.length <= 1} onClick={() => { commit((s) => ({ ...s, pages: s.pages.filter((_, i) => i !== pageMenu) })); setPageMenu(null); setPage(0); say('Страница удалена. Вернуть — стрелка «отменить» вверху'); }}><Trash2 size={18} />Удалить страницу</Btn>
          </div>
        )}
      </Panel>

      <Panel open={menu} onClose={() => setMenu(false)} title="Лист">
        <div className="grid gap-2 pb-2">
          <Btn onClick={() => { setMenu(false); setSettings(true); }}><Settings2 size={18} />Название, шрифт, бумага, эмблема</Btn>
          <Btn onClick={() => { setMenu(false); setTimeout(() => window.print(), 300); }}><Printer size={18} />Печать или PDF</Btn>
          <Btn onClick={() => saveFile(`${sheet.name.replace(/[^\p{L}\p{N}]+/gu, '_') || 'list'}.json`, new Blob([JSON.stringify(sheet)], { type: 'application/json' }))}><Download size={18} />Сохранить файлом (.json)</Btn>
          <Btn onClick={async () => { const id = await create({ ...sheet, name: `${sheet.name} (копия)` }); setMenu(false); await open(id); say('Создана копия листа'); }}><Copy size={18} />Копия листа</Btn>
          <p className="text-xs text-cream/40 px-1 pt-1">Версия от {new Date(Number(__BUILD__)).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-xs text-cream/50 px-1 pt-2 leading-relaxed">PDF на iPhone: «Печать или PDF» → в окне печати нажмите «Поделиться» (квадрат со стрелкой) → «Сохранить в Файлы». Белые поля 12 мм оставлены специально: принтер не печатает края листа.</p>
        </div>
      </Panel>
    </div>
  );
}
