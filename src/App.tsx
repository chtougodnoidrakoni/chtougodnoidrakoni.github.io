import { useEffect, useState } from 'react';
import { ArrowLeft, Undo2, Redo2, Settings2, Printer, Download, Plus, Pencil, Check, Trash2, Copy, ChevronUp, ChevronDown, Upload, FilePlus2, MoreHorizontal, LayoutTemplate, BookOpen, Wand2, Dices, Share2 } from 'lucide-react';
import { Help } from './Help';
import { Dragon } from './Dragon';
import { NavFab } from './NavFab';
import { InstallButtons } from './Install';
import { Feedback } from './Feedback';
import { PromptButton } from './PromptMaker';
import { AiPaste } from './AiPaste';
import { PlayPanel } from './PlayPanel';
import { allSheets, BACKUP_KIND, backupDue, markBackup, sheetFromLink, sheetsFromFile, shareLink, snoozeBackup } from './backup';
import { inTelegram, openExternal, shareInTelegram } from './tgBack';
import { useStore } from './store';
import { makeBlock, oneshotTemplate, PAGE_TEMPLATES, relayoutFromTemplate, sheetName, uid, type BlockType, type Sheet } from './model';
import { LayoutPage, SpellbookPages } from './Page';
import { findFree } from './layout';
import { SYSTEMS, systemTemplate } from './systems';
import { buildPdf, sharePdf } from './pdf';
import { FillModal } from './Fill';
import { AddBlockPanel, Btn, Inspector, Sheet as Panel, SettingsPanel, SpellPicker, TextIn } from './Panels';

declare const __BUILD__: string;
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

async function saveFile(name: string, blob: Blob) {
  // на компьютере — только скачивание: системное «Поделиться» в Windows не работает
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
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const f = () => setHash(location.hash); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  useEffect(() => {
    void boot().then(async () => {
      if (location.hash.startsWith('#share=')) {
        const h = location.hash;
        const todo = h.match(/&do=(pdf|save|print)/)?.[1];
        const s = await sheetFromLink(h); history.replaceState(null, '', location.pathname);
        if (s && todo) try { sessionStorage.setItem('auto-do', todo); } catch { /* */ }
        if (s) { const st = useStore.getState(); const id = await st.create({ ...s, name: s.name && s.name !== 'Новый персонаж' && !todo ? `${s.name} (по ссылке)` : s.name }); await st.open(id); st.say(todo ? 'Лист открыт в браузере' : 'Лист по ссылке добавлен в ваши листы'); }
        else useStore.getState().say('Ссылка повреждена — попросите прислать её заново');
        return;
      }
      const m = location.hash.match(/sheet\/(\w+)/); if (m) void open(m[1]!);
    });
  }, [boot, open]);
  if (!ready) return <div className="h-screen grid place-items-center text-sand">…</div>;
  return (
    <>
      {sheet ? <Editor /> : hash.startsWith('#help') ? <Help print={hash === '#help-print'} onBack={hash === '#help-print' ? undefined : () => { history.replaceState(null, '', location.pathname); setHash(''); scrollTo(0, 0); }} /> : <Home />}
      {hash !== '#help-print' && <NavFab />}
      {toast && <div className="fixed top-0 inset-x-0 z-[70] flex justify-center pt-16 pointer-events-none no-print"><div className="px-4 py-3 rounded-xl bg-moss border border-sand/50 text-sm shadow-xl">{toast}</div></div>}
    </>
  );
}

const CLUB_LINKS = [
  { label: 'Чат', href: 'https://t.me/+a1t_Jic-Wpc1ZDIy', icon: 'chat' },
  { label: 'Канал', href: 'https://t.me/chto_ugodno_i_drakon', icon: 'tg' },
] as const;
function LinkIcon({ k }: { k: (typeof CLUB_LINKS)[number]['icon'] }) {
  const p = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (k === 'tg') return <svg {...p}><path d="M21.5 4.5 2.8 11.6c-.8.3-.8 1.4 0 1.7l4.6 1.6 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.5 4.8 3.5c.6.4 1.4.1 1.6-.6l3.1-15.4c.2-.9-.7-1.6-1.4-1.4Z" /><path d="m7.5 14.9 9.6-6.4-6.9 7.5" /></svg>;
  return <svg {...p}><path d="M20 12a8 8 0 0 1-11.8 7L4 20l1.1-4A8 8 0 1 1 20 12Z" /><path d="M8.5 11h7M8.5 14h4.5" /></svg>;
}
function ClubLinks() {
  return (
    <div className="mt-5">
      <div className="text-sm text-cream/70 px-1 mb-2">Клуб «Что угодно и драконы»</div>
      <div className="grid grid-cols-3 gap-2">
        {CLUB_LINKS.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="h-10 rounded-xl bg-moss/70 border border-moss-light text-sm text-cream inline-flex items-center justify-center gap-1.5">
            <span className="text-sand-light"><LinkIcon k={l.icon} /></span>{l.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function BackupRow() {
  const { index, say } = useStore();
  const [due, setDue] = useState(() => backupDue(index.length));
  if (!index.length) return null;
  const save = async () => {
    const sheets = await allSheets(index);
    const d = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-');
    await saveFile(`Листы ЧУиД ${d}.json`, new Blob([JSON.stringify({ kind: BACKUP_KIND, at: Date.now(), sheets })], { type: 'application/json' }));
    markBackup(); setDue(false); say(`Сохранено листов: ${sheets.length}`);
  };
  return (
    <div className="mt-3">
      {due && (
        <div className="mb-2 rounded-xl border border-sand/50 bg-sand/10 p-3 text-sm text-cream/85">
          Листы хранятся только на этом телефоне. Неделю не было резервной копии — сохраните все листы одним файлом, например себе в «Избранное» в Telegram.
          <div className="mt-2 flex gap-2"><Btn tone="gold" className="flex-1" onClick={save}><Download size={16} />Сохранить</Btn><Btn onClick={() => { snoozeBackup(); setDue(false); }}>Позже</Btn></div>
        </div>
      )}
      {!due && <button onClick={save} className="w-full h-10 rounded-xl border border-moss-light text-sm text-cream/80 inline-flex items-center justify-center gap-2"><Download size={16} />Сохранить все листы одним файлом ({index.length})</button>}
    </div>
  );
}

function Home() {
  const { index, create, open, remove, say } = useStore();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [kind, setKind] = useState(false);
  return (
    <>
    <Dragon />
    <div className="max-w-xl mx-auto px-4 pb-16 relative" style={{ zIndex: 1 }}>
      <header className="safe-top pt-6 pb-4 flex items-center gap-4">
        <img src={`${import.meta.env.BASE_URL}icons/club-emblem.png`} alt="" className="w-16 h-16" />
        <div><div className="font-display-sc text-3xl text-sand-light leading-none">Лист персонажа</div><div className="text-sm text-cream/60 mt-1">клуб «Что угодно и драконы»</div><div className="text-xs text-cream/50 mt-1">Разработано inst: <a href="https://instagram.com/zamir.digital" target="_blank" rel="noopener" className="text-sand-light underline underline-offset-2">zamir.digital</a></div></div>
      </header>
      <div className="grid gap-2">
        <div className="text-sm text-cream/70 px-1">Новый лист — выберите игру:</div>
        <div className="grid grid-cols-2 gap-2">{SYSTEMS.map((g) => (
          <button key={g.id} className={`rounded-2xl p-3 text-left border ${g.id === 'dnd' ? 'bg-gradient-to-b from-sand-light to-sand text-moss-deep border-sand-light' : 'bg-moss border-moss-light text-cream'}`}
            onClick={async () => (g.id === 'dnd' ? setKind(true) : open(await create(systemTemplate(g.id))))}>
            <div className="flex items-center gap-2 font-display-sc text-lg leading-tight"><FilePlus2 size={18} />{g.name}</div>
            <div className={`text-xs mt-1 ${g.id === 'dnd' ? 'text-moss-deep/70' : 'text-cream/60'}`}>{g.hint}</div>
          </button>
        ))}</div>
        <Panel open={kind} onClose={() => setKind(false)} title="Какой лист D&D">
          <div className="grid gap-2 pb-2">
            <button className="rounded-2xl p-4 text-left border bg-gradient-to-b from-sand-light to-sand text-moss-deep border-sand-light" onClick={async () => { setKind(false); open(await create(oneshotTemplate())); }}>
              <div className="font-display-sc text-lg">Для ваншота</div><div className="text-sm text-moss-deep/75 mt-0.5">Сразу характеристики с цифрами, как в классическом листе. Без большой биографии</div>
            </button>
            <button className="rounded-2xl p-4 text-left border bg-moss border-moss-light text-cream" onClick={async () => { setKind(false); open(await create()); }}>
              <div className="font-display-sc text-lg text-sand-light">Для кампании</div><div className="text-sm text-cream/65 mt-0.5">Первая страница — портрет, внешность, предыстория, цели и союзники</div>
            </button>
          </div>
        </Panel>
        <PromptButton />
        <a href="#help" onClick={() => scrollTo(0, 0)} className="h-11 rounded-xl border border-sand/60 text-sand-light inline-flex items-center justify-center gap-2"><BookOpen size={18} />Как пользоваться сайтом</a>
        <label className="h-11 rounded-xl bg-moss border border-moss-light inline-flex items-center justify-center gap-2 cursor-pointer"><Upload size={18} />Открыть файл листа или копию (.json)
          <input type="file" accept=".json,application/json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try {
              const list = sheetsFromFile(JSON.parse(await f.text()));
              if (!list.length) throw new Error();
              if (list.length === 1) { void open(await create(list[0]!)); say('Лист открыт'); }
              else { for (const x of [...list].reverse()) await create(x); say(`Загружено листов: ${list.length}`); }
            } catch { say('Это не файл листа'); }
            e.target.value = '';
          }} />
        </label>
      </div>
      <BackupRow />
      <InstallButtons />
      <ClubLinks />
      <Feedback />
      <div className="mt-6 grid gap-2">
        {index.map((m) => (
          <div key={m.id} className="flex items-center gap-2 p-4 rounded-2xl bg-moss/70 border border-moss-light">
            <button className="flex-1 text-left" onClick={() => open(m.id)}>
              <div className="font-display-sc text-xl text-cream">{m.name || 'Без названия'}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-cream/50">
                <span className={`px-2 py-0.5 rounded-full border ${(m.system ?? 'dnd') === 'dnd' ? 'border-sand/60 text-sand' : 'border-cream/30 text-cream/80'}`}>{SYSTEMS.find((g) => g.id === (m.system ?? 'dnd'))?.name}</span>
                <span>изменён {new Date(m.updatedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </button>
            {confirm === m.id
              ? <Btn tone="danger" onClick={async () => { await remove(m.id); setConfirm(null); }}>Удалить?</Btn>
              : <button className="w-10 h-10 grid place-items-center text-cream/60" onClick={() => setConfirm(m.id)}><Trash2 size={18} /></button>}
          </div>
        ))}
        {!index.length && <p className="text-center text-cream/50 text-sm mt-6">Здесь будут ваши листы. Всё хранится на этом телефоне.</p>}
      </div>
      <p className="text-xs text-cream/40 mt-10 leading-relaxed">Описания заклинаний — из System Reference Document 5.1 и 5.2 (Wizards of the Coast, CC-BY-4.0). Листы Зова Ктулху, Клинков во тьме и Киберпанка RED нарисованы клубом с нуля и содержат только названия полей. Неофициальный проект, не связан с правообладателями игр.</p>
    </div>
    </>
  );
}

function Editor() {
  const st = useStore();
  const { sheet, editPage, setEditPage, undo, redo, past, future, close, commit, selected, pageIdx, setPage, create, open, say } = st;
  const scale = useScale();
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [play, setPlay] = useState(false);
  const [pdf, setPdf] = useState<{ done: number; total: number; bytes?: Uint8Array } | null>(null);
  const makePdf = async () => {
    if (pdf && !pdf.bytes) return;
    useStore.getState().fill(undefined); useStore.getState().select(undefined);
    setPdf({ done: 0, total: document.querySelectorAll('.page').length });
    await new Promise((r) => setTimeout(r, 60));
    try {
      const bytes = await buildPdf((done, total) => setPdf({ done, total }));
      setPdf({ done: 1, total: 1, bytes });
    } catch (e) {
      setPdf(null);
      say('Не получилось собрать PDF. Попробуйте «Системная печать» в меню «⋯»');
      console.error(e);
    }
  };
  /** В Telegram скачать файл нельзя — открываем этот же лист в обычном браузере, там всё сработает. */
  const viaBrowser = async (todo: 'pdf' | 'save' | 'print') => {
    if (!sheet || !inTelegram()) return false;
    say('Открываю лист в браузере — Telegram не умеет сохранять файлы');
    openExternal(await shareLink(sheet, `&do=${todo}`));
    return true;
  };
  useEffect(() => {
    let todo: string | null = null; try { todo = sessionStorage.getItem('auto-do'); sessionStorage.removeItem('auto-do'); } catch { /* */ }
    if (todo === 'pdf') setTimeout(() => void makePdf(), 600);
    if (todo === 'print') setTimeout(() => window.print(), 800);
    if (todo === 'save') { setMenu(true); say('Нажмите «Сохранить на устройство»'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pdfOrBrowser = async () => { if (!(await viaBrowser('pdf'))) await makePdf(); };
  const saveToDevice = async () => {
    if (!sheet || (await viaBrowser('save'))) return;
    await saveFile(`${sheetName(sheet).replace(/[^\p{L}\p{N}]+/gu, '_') || 'list'}.json`, new Blob([JSON.stringify(sheet)], { type: 'application/json' }));
    say('Файл листа сохранён. Открыть его снова: на главной «Открыть файл листа»');
  };
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
          <div className="flex-1 min-w-0 font-display-sc text-xl truncate">{sheetName(sheet)}</div>
          <button className="w-10 h-10 grid place-items-center disabled:opacity-30" disabled={!past.length} onClick={undo} aria-label="Отменить"><Undo2 size={20} /></button>
          <button className="w-10 h-10 grid place-items-center disabled:opacity-30" disabled={!future.length} onClick={redo} aria-label="Повторить"><Redo2 size={20} /></button>
          <button className="w-10 h-10 grid place-items-center text-sand-light" onClick={saveToDevice} aria-label="Скачать файл листа на устройство" title="Сохранить на устройство"><Download size={20} /></button>
          <button className="w-11 h-11 grid place-items-center text-sand-light" onClick={() => setMenu(true)} aria-label="Меню"><MoreHorizontal /></button>
        </div>
      </header>

      <main className="pt-3">
        {sheet.pages.map((p, i) => {
          const header = (
            <div className="no-print max-w-[820px] mx-auto px-3 flex items-center gap-2 text-sm text-cream/70 mb-1.5">
              <span className="font-display-sc text-base text-sand-light truncate">{p.title}</span>
              {i === 0 && <button className="h-9 px-3 rounded-full border border-sand/60 text-sand-light inline-flex items-center gap-1.5 shrink-0" onClick={() => setSettings(true)} aria-label="Стиль листа"><Pencil size={15} />Стиль</button>}
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
            <Btn className="flex-1 !px-2" onClick={() => setAddPage(true)}><Plus size={18} />Страница</Btn>
            <Btn className="flex-1 !px-2" onClick={() => setAddBlock(true)}><LayoutTemplate size={18} />Блок</Btn>
            <Btn className="flex-1 !px-2 !border-sand/70 !text-sand-light" onClick={() => setPlay(true)}><Dices size={18} />Играть</Btn>
            <Btn tone="gold" className="flex-1 !px-2" onClick={() => void pdfOrBrowser()}><Printer size={18} />PDF</Btn>
          </div>
        </div>
      )}

      <Inspector />
      <FillModal />
      <SpellPicker />
      <SettingsPanel open={settings} onClose={() => setSettings(false)} />
      <AiPaste open={aiOpen} onClose={() => setAiOpen(false)} />
      <PlayPanel open={play} onClose={() => setPlay(false)} />
      {pdf && (
        <div className="fixed inset-0 z-[60] no-print bg-black/60 grid place-items-center p-6" onClick={() => pdf.bytes && setPdf(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-moss-dark border border-moss-light p-5 text-center" onClick={(e) => e.stopPropagation()}>
            {!pdf.bytes ? <>
              <div className="font-display-sc text-xl text-sand-light">Собираю PDF</div>
              <div className="text-sm text-cream/70 mt-2">Страница {Math.min(pdf.done + 1, pdf.total)} из {pdf.total}</div>
              <div className="h-2 rounded-full bg-moss-deep mt-4 overflow-hidden"><div className="h-full bg-sand transition-all" style={{ width: `${(pdf.done / Math.max(1, pdf.total)) * 100}%` }} /></div>
            </> : <>
              <div className="font-display-sc text-xl text-sand-light">PDF готов</div>
              <div className="text-sm text-cream/70 mt-2">Сохраните в Файлы, отправьте в Telegram или сразу напечатайте</div>
              <Btn tone="gold" className="w-full mt-4" onClick={() => void sharePdf(pdf.bytes!, sheetName(sheet))}><Download size={18} />Сохранить или отправить</Btn>
              <button className="mt-2 h-10 w-full text-sand-light underline underline-offset-4" onClick={() => void sharePdf(pdf.bytes!, sheetName(sheet), true)}>Скачать файлом</button>
              <button className="mt-3 h-10 text-cream/70" onClick={() => setPdf(null)}>Закрыть</button>
            </>}
          </div>
        </div>
      )}
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
          <Btn onClick={() => { setMenu(false); setSettings(true); }}><Settings2 size={18} />Стиль, название, шрифт, эмблема</Btn>
          <Btn onClick={() => { setMenu(false); setAiOpen(true); }}><Wand2 size={18} />Заполнить ответом нейросети</Btn>
          <Btn onClick={() => { setMenu(false); close(); location.hash = '#help'; scrollTo(0, 0); }}><BookOpen size={18} />Как пользоваться сайтом</Btn>
          <Btn onClick={() => { setMenu(false); setTimeout(() => void pdfOrBrowser(), 300); }}><Printer size={18} />Скачать PDF</Btn>
          <Btn onClick={async () => { setMenu(false); if (!(await viaBrowser('print'))) setTimeout(() => window.print(), 300); }}><Printer size={18} />Системная печать</Btn>
          <Btn onClick={async () => { const url = await shareLink(sheet); if (inTelegram() && shareInTelegram(url, `Лист персонажа «${sheetName(sheet)}»`)) return; const nav = navigator as Navigator; if (nav.share && /iPhone|iPad|Android/i.test(navigator.userAgent)) { try { await nav.share({ url }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } } try { await navigator.clipboard.writeText(url); say('Ссылка скопирована — отправьте её мастеру или другу'); } catch { prompt('Скопируйте ссылку', url); } }}><Share2 size={18} />Поделиться ссылкой на лист</Btn>
          <Btn onClick={() => { setMenu(false); void saveToDevice(); }}><Download size={18} />Сохранить на устройство</Btn>
          <Btn onClick={async () => { const id = await create({ ...sheet, name: `${sheetName(sheet)} (копия)` }); setMenu(false); await open(id); say('Создана копия листа'); }}><Copy size={18} />Копия листа</Btn>
          <p className="text-xs text-cream/40 px-1 pt-1">Версия от {new Date(Number(__BUILD__)).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-xs text-cream/50 px-1 pt-2 leading-relaxed">«Скачать PDF» собирает файл прямо здесь: потом его можно сохранить в Файлы, отправить в Telegram или напечатать. Белые поля оставлены специально: принтер не печатает края листа.</p>
        </div>
      </Panel>
    </div>
  );
}
