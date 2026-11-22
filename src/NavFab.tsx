import { useState } from 'react';
import { ArrowUp, BookOpen, Compass, Home, RotateCw, X } from 'lucide-react';
import { useStore } from './store';

/** Плавающая кнопка навигации: на iPhone с иконкой на экране нет кнопок браузера. */
export function NavFab() {
  const { sheet, close } = useStore();
  const [open, setOpen] = useState(false);
  const goHome = () => { setOpen(false); if (sheet) close(); history.replaceState(null, '', location.pathname); dispatchEvent(new HashChangeEvent('hashchange')); scrollTo(0, 0); };
  const item = 'h-11 px-4 rounded-full bg-moss-dark border border-sand/50 text-cream text-sm inline-flex items-center gap-2 shadow-xl whitespace-nowrap';
  const pages = sheet?.pages ?? [];
  return (
    <div className="nav-fab fixed right-4 z-40 no-print flex flex-col items-end gap-2" style={{ bottom: `calc(env(safe-area-inset-bottom) + ${sheet ? 104 : 20}px)` }}>
      {open && (
        <>
          <div className="fixed inset-0 -z-10" onClick={() => setOpen(false)} />
          {pages.length > 1 && (
            <div className="max-h-[40vh] overflow-auto flex flex-col items-end gap-2">
              {pages.map((p, i) => <button key={p.id} className={item} onClick={() => { setOpen(false); document.getElementById(`page-${p.id}`)?.scrollIntoView({ behavior: 'smooth' }); }}><span className="text-sand-light">{i + 1}</span>{p.title}</button>)}
            </div>
          )}
          <button className={item} onClick={() => { setOpen(false); scrollTo({ top: 0, behavior: 'smooth' }); }}><ArrowUp size={17} />Наверх</button>
          <button className={item} onClick={goHome}><Home size={17} />На главную</button>
          <button className={item} onClick={() => { goHome(); location.hash = '#help'; }}><BookOpen size={17} />Как пользоваться</button>
          <button className={item} onClick={() => location.reload()}><RotateCw size={17} />Обновить страницу</button>
        </>
      )}
      <button aria-label="Навигация" onClick={() => setOpen((o) => !o)}
        className="w-13 h-13 w-[52px] h-[52px] rounded-full bg-sand text-moss-deep grid place-items-center shadow-[0_8px_24px_rgba(0,0,0,.55)] border border-sand-light/60">
        {open ? <X size={24} /> : <Compass size={24} />}
      </button>
    </div>
  );
}
