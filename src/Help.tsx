import { ArrowLeft, Lightbulb } from 'lucide-react';
import { HELP, type HelpItem } from './help';

const src = (n: string) => `${import.meta.env.BASE_URL}help/${n}.webp`;

function Shot({ img, cap, wide }: { img: string; cap?: string; wide?: boolean }) {
  return (
    <figure className={`help-fig ${wide ? 'wide' : ''}`}>
      <img src={src(img)} alt={cap ?? ''} loading="lazy" />
      {cap && <figcaption>{cap}</figcaption>}
    </figure>
  );
}

function Item({ it, start = 0 }: { it: HelpItem; start?: number }) {
  if ('p' in it) return <p className="help-p">{it.p}</p>;
  if ('tip' in it) return <div className="help-tip"><Lightbulb size={18} className="shrink-0 mt-0.5" /><span>{it.tip}</span></div>;
  if ('steps' in it) return <ul className="help-steps" style={{ counterReset: `st ${start}` }}>{it.steps.map((s, i) => <li key={i}>{s}</li>)}</ul>;
  if ('imgs' in it) return <div className="help-row">{it.imgs.map((x) => <Shot key={x.img} {...x} />)}</div>;
  return <Shot {...it} />;
}

export function Help({ onBack, print }: { onBack?: () => void; print?: boolean }) {
  return (
    <div className={`help max-w-xl mx-auto px-4 pb-20 ${print ? 'help-print' : ''}`}>
      <header className="safe-top pt-5 pb-3 flex items-center gap-3">
        {onBack && <button className="w-11 h-11 -ml-2 grid place-items-center text-sand-light" onClick={onBack} aria-label="Назад"><ArrowLeft /></button>}
        <img src={`${import.meta.env.BASE_URL}icons/club-emblem.png`} alt="" className="w-12 h-12" />
        <div>
          <div className="font-display-sc text-2xl text-sand-light leading-none">Как пользоваться</div>
          <div className="text-xs text-cream/60 mt-1">лист персонажа клуба «Что угодно и драконы»</div>
        </div>
      </header>
      <nav className="help-toc">
        {HELP.map((s, i) => <a key={s.id} href={`#help-${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`help-${s.id}`)?.scrollIntoView({ behavior: 'smooth' }); }}><b>{i + 1}</b>{s.title}{s.who && <em>{s.who}</em>}</a>)}
      </nav>
      {HELP.map((s, i) => (
        <section key={s.id} id={`help-${s.id}`} className="help-sec">
          <h2><b>{i + 1}</b>{s.title}{s.who && <em>{s.who}</em>}</h2>
          {s.items.map((it, k) => <Item key={k} it={it} start={s.items.slice(0, k).reduce((n, x) => n + ('steps' in x ? x.steps.length : 0), 0)} />)}
        </section>
      ))}
      <div className="text-center text-xs text-cream/45 mt-10">Что угодно и драконы • г. Астрахань · сайт: chtougodnoidrakoni.github.io<br />Разработано inst: zamir.digital</div>
    </div>
  );
}
