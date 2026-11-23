import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, FileUp, History, Power, Trash2, Undo2, Upload, KeyRound } from 'lucide-react';
import { Btn, TextIn } from '../Panels';
import { allSubs, exportBuiltIn, importPack, loadLog, packText, readPack, removePack, setEnabled, undoLast, validate, type LogEntry, type PackIn, type Report, type StoredPack } from './content';
import { publish, tokenOk } from './publish';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const file = new File([blob], name, { type: 'text/plain' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) { nav.share({ files: [file] }).catch(() => {}); return; }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
}

/** «Библиотека контента D&D»: импорт, предпросмотр, включение, экспорт, журнал, публикация для всех. */
export function Library({ local, club, onChange, onBack }: { local: StoredPack[]; club: StoredPack[]; onChange: (l: StoredPack[]) => void; onBack: () => void }) {
  const [rep, setRep] = useState<Report & { file: string }>();
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [paste, setPaste] = useState('');
  const [token, setToken] = useState(() => { try { return localStorage.getItem('gh-token') ?? ''; } catch { return ''; } });
  const [pubState, setPub] = useState<Record<string, string>>({});
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { void loadLog().then(setLog); }, [local]);

  const check = (text: string, file: string) => {
    setErr(''); setDone('');
    const r = readPack(text);
    if (r.error) { setRep(undefined); setErr(r.error); return; }
    setRep({ ...validate(r.data, [...club, ...local]), file });
  };
  const onFile = async (f?: File) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setErr('Файл больше 8 МБ'); return; }
    if (!/\.(txt|json)$/i.test(f.name)) { setErr('Нужен файл .txt (или .json) с пакетом в формате JSON'); return; }
    check(await f.text(), f.name);
  };
  const confirm = async () => {
    if (!rep?.pack) return;
    try { const n = await importPack(rep.pack, rep.file); onChange(n); setDone(`Готово: «${rep.pack.pack_name}» — классов ${rep.stats.classes}, подклассов ${rep.stats.subclasses}, способностей ${rep.stats.features}. Уже доступно в сборке.`); setRep(undefined); setPaste(''); }
    catch (e) { setErr(`Импорт не выполнен, ничего не изменилось: ${(e as Error).message}`); }
  };
  const doPublish = async (p: PackIn) => {
    try { localStorage.setItem('gh-token', token); } catch { /* приватный режим */ }
    setPub((x) => ({ ...x, [p.pack_id]: 'Публикую…' }));
    try { await publish(p, token); setPub((x) => ({ ...x, [p.pack_id]: 'Опубликовано. Через 2–3 минуты пакет появится у всех.' })); }
    catch (e) { setPub((x) => ({ ...x, [p.pack_id]: `Не вышло: ${(e as Error).message}` })); }
  };
  const row = (s: StoredPack) => {
    const subs = allSubs(s.pack);
    return (
      <div key={`${s.origin}:${s.pack.pack_id}`} className={cx('rounded-2xl border p-3', s.enabled ? 'border-moss-light bg-moss-deep/60' : 'border-moss-light/50 bg-moss-deep/30 opacity-70')}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-cream">{s.pack.pack_name}</div>
            <div className="text-xs text-cream/55">{s.pack.ruleset === '5e-2014' ? '2014' : '2024'} · v{s.pack.pack_version ?? 1} · {s.origin === 'club' ? 'общий для всех' : 'на этом телефоне'}{s.file ? ` · ${s.file}` : ''}</div>
            <div className="text-xs text-cream/70 mt-1">{(s.pack.classes ?? []).length ? `Классы: ${(s.pack.classes ?? []).map((c) => c.name).join(', ')}. ` : ''}{subs.length ? `Подклассы: ${subs.map((x) => x.name).join(', ')}.` : ''}</div>
          </div>
          {s.origin === 'local' && <button aria-label={`${s.enabled ? 'Выключить' : 'Включить'}: ${s.pack.pack_name}`} onClick={async () => onChange(await setEnabled(s.pack.pack_id, !s.enabled))} className={cx('p-2 rounded-lg', s.enabled ? 'text-sand-light' : 'text-cream/40')}><Power size={18} /></button>}
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Btn className="h-9 text-sm" onClick={() => download(`${s.pack.pack_id}.txt`, packText(s.pack))}><Download size={15} />Экспорт</Btn>
          {s.origin === 'local' && <Btn className="h-9 text-sm" tone="danger" onClick={async () => { if (window.confirm(`Удалить «${s.pack.pack_name}» с этого телефона?`)) onChange(await removePack(s.pack.pack_id)); }}><Trash2 size={15} />Удалить</Btn>}
          {s.origin === 'local' && tokenOk(token) && <Btn className="h-9 text-sm" tone="gold" onClick={() => doPublish(s.pack)}><Upload size={15} />Опубликовать для всех</Btn>}
        </div>
        {pubState[s.pack.pack_id] && <div className="text-xs text-sand-light mt-1.5">{pubState[s.pack.pack_id]}</div>}
      </div>
    );
  };

  return (
    <div className="min-h-dvh pb-16">
      <header className="max-w-xl mx-auto px-4 pt-[max(1rem,env(safe-area-inset-top))] flex items-center gap-3">
        <button onClick={onBack} aria-label="Назад к сборке" className="w-11 h-11 grid place-items-center rounded-xl bg-moss border border-moss-light"><ArrowLeft size={20} /></button>
        <div className="font-display-sc text-2xl text-sand-light leading-tight">Библиотека контента D&D</div>
      </header>
      <main className="max-w-xl mx-auto px-4 mt-4">
        <p className="text-sm text-cream/70 leading-snug mb-3">Здесь добавляются новые классы и подклассы из файла-пакета. Пакет — это .txt с JSON внутри; формат описан в шаблоне. Новые записи сразу появляются в сборке персонажа.</p>
        <input ref={input} type="file" accept=".txt,.json,text/plain,application/json" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
        <Btn tone="gold" className="w-full" onClick={() => input.current?.click()}><FileUp size={18} />+ Импорт классов и подклассов</Btn>
        <details className="mt-2"><summary className="text-sm text-cream/70">Или вставить текст пакета</summary>
          <textarea aria-label="Текст пакета" value={paste} onChange={(e) => setPaste(e.target.value)} className="w-full min-h-32 p-3 mt-2 rounded-xl bg-moss-deep border border-moss-light outline-none text-xs font-mono" placeholder='{ "format": "dnd-content-pack", … }' />
          <Btn className="mt-2" disabled={!paste.trim()} onClick={() => check(paste, 'вставка.txt')}>Проверить</Btn>
        </details>
        <div className="flex gap-2 mt-2 flex-wrap">
          <a className="h-9 px-3 rounded-xl bg-moss border border-moss-light inline-flex items-center gap-1.5 text-sm" href={`${import.meta.env.BASE_URL}content/TEMPLATE.txt`} download>Шаблон TEMPLATE.txt</a>
          <a className="h-9 px-3 rounded-xl bg-moss border border-moss-light inline-flex items-center gap-1.5 text-sm" href={`${import.meta.env.BASE_URL}content/EXAMPLE_srd_subclasses.txt`} download>Пример пакета</a>
          <Btn className="h-9 text-sm" onClick={() => download('builtin_2014.txt', packText(exportBuiltIn('2014')))}>Экспорт встроенных 2014</Btn>
        </div>

        {err && <div className="mt-4 rounded-2xl border border-red-400/60 bg-red-400/10 p-3 text-sm text-red-200">{err}</div>}
        {done && <div className="mt-4 rounded-2xl border border-sand/60 bg-sand/10 p-3 text-sm text-sand-light">{done}</div>}
        {rep && (
          <div className="mt-4 rounded-2xl border border-sand/60 bg-moss-dark p-3">
            <div className="font-display-sc text-xl text-sand-light">Предпросмотр: {rep.pack?.pack_name ?? rep.file}</div>
            <div className="grid grid-cols-3 gap-2 my-2 text-center">
              {[['Новых классов', rep.stats.newClasses.length], ['Новых подклассов', rep.stats.newSubclasses.length], ['Обновится', rep.stats.updated.length]].map(([l, v]) => <div key={l} className="rounded-xl bg-moss-deep border border-moss-light py-2"><div className="text-xl text-cream">{v}</div><div className="text-[11px] text-cream/60 leading-tight">{l}</div></div>)}
            </div>
            <div className="text-xs text-cream/70">Всего в файле: классов {rep.stats.classes}, подклассов {rep.stats.subclasses}, способностей {rep.stats.features}.</div>
            {rep.stats.newClasses.length > 0 && <div className="text-xs text-cream/80 mt-1">Новые классы: {rep.stats.newClasses.join(', ')}</div>}
            {rep.stats.newSubclasses.length > 0 && <div className="text-xs text-cream/80 mt-1">Новые подклассы: {rep.stats.newSubclasses.join(', ')}</div>}
            {rep.stats.updated.length > 0 && <div className="text-xs text-cream/80 mt-1">Обновятся: {rep.stats.updated.join(', ')}</div>}
            {rep.errors.length > 0 && <div className="mt-2"><div className="text-sm text-red-300">Ошибки ({rep.errors.length}) — импорт невозможен:</div><ul className="text-xs text-red-200/90 list-disc pl-5 max-h-48 overflow-y-auto">{rep.errors.slice(0, 100).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
            {rep.warnings.length > 0 && <div className="mt-2"><div className="text-sm text-amber-300">Предупреждения ({rep.warnings.length}):</div><ul className="text-xs text-amber-200/90 list-disc pl-5 max-h-40 overflow-y-auto">{rep.warnings.slice(0, 100).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
            <div className="flex gap-2 mt-3">
              <Btn className="flex-1" onClick={() => setRep(undefined)}>Отменить</Btn>
              <Btn tone="gold" className="flex-1" disabled={!rep.ok || rep.mode === 'same'} onClick={confirm}>Импортировать</Btn>
            </div>
          </div>
        )}

        <div className="text-sm text-sand-light mt-6 mb-2">Пакеты на этом телефоне</div>
        <div className="grid gap-2">{local.length ? local.map(row) : <div className="text-sm text-cream/50">Пока нет. Загрузите файл кнопкой выше.</div>}</div>
        {club.length > 0 && <><div className="text-sm text-sand-light mt-6 mb-2">Общие пакеты клуба</div><div className="grid gap-2">{club.map(row)}</div></>}

        <div className="flex gap-2 mt-6 flex-wrap">
          <Btn className="text-sm" onClick={() => setShowLog(!showLog)}><History size={16} />Журнал импорта</Btn>
          <Btn className="text-sm" onClick={async () => { if (window.confirm('Вернуть пакеты к состоянию до последнего изменения?')) onChange(await undoLast()); }}><Undo2 size={16} />Откатить последнее</Btn>
        </div>
        {showLog && <div className="mt-2 grid gap-1 text-xs text-cream/75">{log.length ? log.map((l, i) => <div key={i} className="rounded-lg bg-moss-deep/60 border border-moss-light/60 px-2 py-1.5">{new Date(l.at).toLocaleString('ru')} · {l.who} · {l.file || '—'} · {l.pack} · {l.result}</div>) : 'Записей нет.'}</div>}

        <details className="mt-6 rounded-2xl border border-moss-light p-3">
          <summary className="text-sm text-cream/80 inline-flex items-center gap-1.5"><KeyRound size={15} />Публикация для всех (для администратора)</summary>
          <p className="text-xs text-cream/65 mt-2 leading-snug">Пакеты с телефона видите только вы. Чтобы пакет появился у всех игроков, его нужно записать в общую базу сайта. Для этого нужен ключ доступа GitHub с правом записи в репозиторий клуба. Без ключа опубликовать нельзя — это и есть защита от посторонних. Ключ хранится только на этом телефоне.</p>
          <TextIn className="mt-2" aria-label="Ключ GitHub" type="password" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value.trim())} />
          <div className="text-xs text-cream/50 mt-1">{tokenOk(token) ? 'Ключ введён — у пакетов на телефоне появилась кнопка «Опубликовать для всех».' : 'Ключ не введён.'}</div>
        </details>
      </main>
    </div>
  );
}
