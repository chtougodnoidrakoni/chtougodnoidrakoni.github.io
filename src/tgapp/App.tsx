import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, CalendarDays, Crown, ImagePlus, Plus, Settings, Sparkles, Swords, ScrollText, Users, X } from 'lucide-react';
import { Btn, Field, TextIn } from '../Panels';
import { api, fmtDay, fmtTime, imgUrl, loadConfig, toIso, toLocal, type Game, type Player, type Role } from './api';
import { confirmBox, haptic, openLink, setupTelegram, tg } from './tg';

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');
const ROOT = import.meta.env.BASE_URL.replace(/app\/?$/, '');
const SITES = { builder: `${location.origin}${ROOT}builder/`, sheet: `${location.origin}${ROOT}` };
const LINKS = [
  { t: 'Telegram-канал', u: 'https://t.me/chto_ugodno_i_drakon' },
  { t: 'Чат клуба', u: 'https://t.me/+a1t_Jic-Wpc1ZDIy' },
  { t: 'Instagram', u: 'https://www.instagram.com/chto_ugodno_i_drakoni' },
];
export const SYSTEMS = ['D&D 2014', 'D&D 2024', 'Зов Ктулху', 'Клинки во тьме', 'Киберпанк RED'];

type View = { name: 'list' } | { name: 'game'; id: number } | { name: 'my' } | { name: 'admin' } | { name: 'edit'; id?: number; copy?: number; day?: string; room?: 'red' | 'green' };
const parseHash = (): View => {
  const h = location.hash.replace(/^#/, '');
  const g = h.match(/^game\/(\d+)/); if (g) return { name: 'game', id: +g[1]! };
  const e = h.match(/^edit\/(\d+)/); if (e) return { name: 'edit', id: +e[1]! };
  const c = h.match(/^copy\/(\d+)/); if (c) return { name: 'edit', copy: +c[1]! };
  const n = h.match(/^new(?:\/(\d{4}-\d{2}-\d{2})\/(red|green))?$/); if (n) return { name: 'edit', day: n[1], room: n[2] as 'red' | 'green' | undefined };
  if (h === 'my') return { name: 'my' };
  if (h === 'admin') return { name: 'admin' };
  return { name: 'list' };
};
const go = (h: string) => { location.hash = h; scrollTo(0, 0); };

export function App() {
  const [ready, setReady] = useState<'load' | 'ok' | 'noapi'>('load');
  const [view, setView] = useState<View>(parseHash);
  const [role, setRole] = useState<Role>('guest');
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [toast, setToast] = useState('');
  useEffect(() => { setupTelegram(); void loadConfig().then(async (b) => { if (!b) { setReady('noapi'); return; } setReady('ok'); try { const m = await api.me(); setRole(m.role); setUser(m.user); } catch { /* гость */ } }); }, []);
  useEffect(() => { const f = () => setView(parseHash()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  // кнопка «Назад» Telegram на всех экранах, кроме главного
  useEffect(() => {
    if (!tg) return;
    const back = () => (view.name === 'edit' && view.id ? go(`game/${view.id}`) : history.length > 1 ? history.back() : go(''));
    if (view.name === 'list') tg.BackButton.hide(); else { tg.BackButton.show(); tg.BackButton.onClick(back); }
    return () => tg?.BackButton.offClick(back);
  }, [view]);
  const say = useCallback((t: string) => { setToast(t); setTimeout(() => setToast(''), 2600); }, []);
  const staff = role === 'admin' || role === 'master';

  return (
    <div className="min-h-dvh pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="max-w-xl mx-auto px-4 pt-[max(.75rem,env(safe-area-inset-top))]">
        {view.name === 'list' || view.name === 'my' || view.name === 'admin' ? (
          <>
            <header className="flex items-center gap-3 pt-2">
              <img src={`${ROOT}icons/icon-192.png`} alt="" className="w-12 h-12 rounded-full" />
              <div className="flex-1 min-w-0">
                <div className="font-display-sc text-xl text-sand-light leading-tight">Что угодно и драконы</div>
                <div className="text-xs text-cream/60">{user ? `Привет, ${user.name.split(' ')[0]}!` : 'Клуб настольных ролевых игр · Астрахань'}</div>
              </div>
            </header>
            <nav className="flex gap-1.5 mt-4 p-1 rounded-2xl bg-moss-deep/70 border border-moss-light/60">
              {([['', 'Игры', <Swords key="s" size={16} />], ['my', 'Мои записи', <CalendarDays key="c" size={16} />], ...(staff ? [['admin', 'Управление', <Settings key="g" size={16} />]] : [])] as [string, string, ReactNode][]).map(([h, t, icon]) => {
                const on = (view.name === 'list' && h === '') || view.name === h;
                return <button key={h} onClick={() => go(h)} className={cx('flex-1 h-10 rounded-xl text-sm inline-flex items-center justify-center gap-1.5', on ? 'bg-sand text-moss-deep font-semibold' : 'text-cream/75')}>{icon}{t}</button>;
              })}
            </nav>
          </>
        ) : null}
        {ready === 'load' && <div className="py-16 text-center text-cream/60">Загружаю…</div>}
        {ready === 'noapi' && <div className="mt-6 rounded-2xl border border-amber-300/50 bg-amber-300/10 p-4 text-sm text-amber-100">Сервер записей ещё не подключён. Как только администратор его включит, здесь появятся игры.</div>}
        {ready === 'ok' && view.name === 'list' && <Week say={say} staff={staff} />}
        {ready === 'ok' && view.name === 'my' && <My />}
        {ready === 'ok' && view.name === 'game' && <GamePage id={view.id} say={say} role={role} />}
        {ready === 'ok' && view.name === 'admin' && staff && <Admin role={role} say={say} />}
        {ready === 'ok' && view.name === 'edit' && staff && <Edit id={view.id} copy={view.copy} day={view.day} room={view.room} say={say} />}
        {(view.name === 'list' || view.name === 'my') && <Links />}
        <div className="text-center text-[11px] text-cream/35 mt-8">Разработано inst: zamir.digital</div>
      </div>
      {toast && <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-50 px-4 py-2.5 rounded-2xl bg-sand text-moss-deep text-sm font-medium shadow-lg max-w-[90vw] text-center">{toast}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ карточки и лента

function Seats({ g, big }: { g: Game; big?: boolean }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Занято ${g.taken} из ${g.seats}`}>
      {Array.from({ length: g.seats }, (_, i) => <span key={i} className={cx('rounded-full border', big ? 'w-4 h-4' : 'w-2.5 h-2.5', i < g.taken ? 'bg-sand border-sand' : 'border-sand/50')} />)}
    </div>
  );
}
const Room = ({ room }: { room: Game['room'] }) => (
  <span className={cx('inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium', room === 'green' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200')}>
    <span className={cx('w-2 h-2 rounded-full', room === 'green' ? 'bg-emerald-400' : 'bg-red-400')} />{room === 'green' ? 'Зелёная комната' : 'Красная комната'}
  </span>
);
const free = (g: Game) => Math.max(0, g.seats - g.taken);
function seatText(g: Game) {
  if (g.status === 'cancelled') return 'Игра отменена';
  if (g.mine === 'main') return 'Вы записаны';
  if (g.mine === 'wait') return 'Вы в листе ожидания';
  return free(g) ? `Свободно ${free(g)} из ${g.seats}` : `Мест нет${g.waiting ? ` · в очереди ${g.waiting}` : ''}`;
}

function Card({ g }: { g: Game }) {
  return (
    <button onClick={() => go(`game/${g.id}`)} aria-label={g.title} className={cx('text-left rounded-3xl overflow-hidden border bg-moss-deep/70 w-full', g.mine ? 'border-sand/70' : 'border-moss-light/70', g.status === 'cancelled' && 'opacity-60')}>
      <div className="relative aspect-[16/9] bg-moss">
        {g.image_id ? <img src={imgUrl(g.image_id)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 grid place-items-center"><img src={`${ROOT}icons/icon-192.png`} alt="" className="w-20 opacity-40" /></div>}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute left-3 top-3"><Room room={g.room} /></div>
        <div className="absolute left-3 bottom-2.5 text-white text-sm font-medium drop-shadow">{fmtDay(g.starts_at)} · {fmtTime(g.starts_at)}</div>
      </div>
      <div className="p-3.5">
        <div className="font-display-sc text-xl text-sand-light leading-tight">{g.title}</div>
        <div className="text-xs text-cream/65 mt-1">{[g.system, g.setting].filter(Boolean).join(' · ')}{g.master_name ? ` · мастер ${g.master_name}` : ''}</div>
        <div className="flex items-center justify-between mt-3"><Seats g={g} /><span className={cx('text-xs', g.mine ? 'text-sand-light font-medium' : free(g) ? 'text-cream/70' : 'text-amber-200/80')}>{seatText(g)}</span></div>
      </div>
    </button>
  );
}

// ------------------------------------------------------------------ расписание недели
const TZ = 'Europe/Astrakhan';
const dayKey = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ }); // 2026-11-24
const addDays = (key: string, n: number) => new Date(Date.parse(`${key}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
function mondayOf(key: string) { const wd = new Date(`${key}T12:00:00Z`).getUTCDay(); return addDays(key, -((wd + 6) % 7)); }
const dayTitle = (key: string) => { const t = new Date(`${key}T12:00:00Z`).toLocaleDateString('ru-RU', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }); return t[0]!.toUpperCase() + t.slice(1); };
const rangeTitle = (a: string, b: string) => {
  const f = (k: string, o: Intl.DateTimeFormatOptions) => new Date(`${k}T12:00:00Z`).toLocaleDateString('ru-RU', { timeZone: 'UTC', ...o });
  return a.slice(5, 7) === b.slice(5, 7) ? `${f(a, { day: 'numeric' })}–${f(b, { day: 'numeric', month: 'long' })}` : `${f(a, { day: 'numeric', month: 'short' })} – ${f(b, { day: 'numeric', month: 'short' })}`;
};

function Tile({ g }: { g: Game }) {
  return (
    <button onClick={() => go(`game/${g.id}`)} aria-label={g.title} className={cx('text-left rounded-2xl border p-2.5 min-h-[7.5rem] flex flex-col', g.room === 'green' ? 'bg-emerald-950/50 border-emerald-500/50' : 'bg-red-950/40 border-red-500/45', g.mine && 'ring-2 ring-sand', g.status === 'cancelled' && 'opacity-55')}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-lg font-semibold text-cream leading-none">{fmtTime(g.starts_at)}</span>
        <span className={cx('w-2.5 h-2.5 rounded-full shrink-0', g.room === 'green' ? 'bg-emerald-400' : 'bg-red-400')} />
      </div>
      <div className="font-display-sc text-[15px] text-sand-light leading-tight mt-1.5 line-clamp-2">{g.title}</div>
      <div className="text-[11px] text-cream/65 mt-0.5 truncate">{g.master_name ? `Мастер: ${g.master_name}` : g.system}</div>
      <div className="mt-auto pt-1.5 flex items-center justify-between gap-1">
        <Seats g={g} />
        <span className={cx('text-[10px]', g.mine ? 'text-sand-light font-medium' : 'text-cream/55')}>{g.status === 'cancelled' ? 'отменена' : g.mine === 'main' ? 'вы идёте' : g.mine === 'wait' ? 'в очереди' : free(g) ? `${free(g)} св.` : 'мест нет'}</span>
      </div>
    </button>
  );
}
function EmptyTile({ room, day, past, staff }: { room: 'red' | 'green'; day: string; past: boolean; staff: boolean }) {
  const can = staff && !past;
  const body = (
    <>
      <div className={cx('text-[11px] font-medium inline-flex items-center gap-1.5', room === 'green' ? 'text-emerald-300/70' : 'text-red-300/70')}><span className={cx('w-2 h-2 rounded-full', room === 'green' ? 'bg-emerald-400/60' : 'bg-red-400/60')} />{room === 'green' ? 'Зелёная' : 'Красная'}</div>
      <div className="text-xs text-cream/40 mt-2 leading-snug">{past ? 'День прошёл' : 'Свободно — игра не запланирована'}</div>
      {can && <div className="mt-auto text-[11px] text-sand-light/80 inline-flex items-center gap-1"><Plus size={12} />Поставить игру</div>}
    </>
  );
  const cls = 'text-left rounded-2xl border border-dashed border-moss-light/60 bg-moss-deep/30 p-2.5 min-h-[7.5rem] flex flex-col';
  return can ? <button aria-label={`Поставить игру: ${dayTitle(day)}, ${room === 'green' ? 'зелёная' : 'красная'}`} onClick={() => go(`new/${day}/${room}`)} className={cls}>{body}</button> : <div className={cls}>{body}</div>;
}

function Week({ say, staff }: { say: (t: string) => void; staff: boolean }) {
  const [games, setGames] = useState<Game[] | null>(null);
  const today = dayKey(new Date());
  const [start, setStart] = useState(() => { const w = new URLSearchParams(location.search).get('week'); return w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? mondayOf(w) : mondayOf(today); });
  useEffect(() => { api.games().then((r) => setGames(r.games)).catch((e) => { say((e as Error).message); setGames([]); }); }, [say]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const thisWeek = mondayOf(today);
  const byDay = new Map<string, Game[]>();
  for (const g of games ?? []) { const k = dayKey(g.starts_at); (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(g); }
  const weekCount = days.reduce((t, d) => t + (byDay.get(d)?.length ?? 0), 0);
  const shift = (n: number) => { setStart(addDays(start, n * 7)); scrollTo({ top: 0, behavior: 'smooth' }); };
  const nav = (
    <div className="flex items-center gap-2">
      <button aria-label="Прошлая неделя" disabled={start <= thisWeek} onClick={() => shift(-1)} className="h-11 w-11 shrink-0 rounded-xl border border-moss-light grid place-items-center disabled:opacity-30"><ArrowLeft size={18} /></button>
      <div className="flex-1 text-center">
        <div className="text-sand-light font-medium">{rangeTitle(days[0]!, days[6]!)}</div>
        <div className="text-[11px] text-cream/55">{start === thisWeek ? 'эта неделя' : start === addDays(thisWeek, 7) ? 'следующая неделя' : 'через ' + Math.round((Date.parse(start) - Date.parse(thisWeek)) / 604800000) + ' нед.'} · игр: {games ? weekCount : '…'}</div>
      </div>
      <button aria-label="Следующая неделя" onClick={() => shift(1)} className="h-11 w-11 shrink-0 rounded-xl border border-moss-light grid place-items-center rotate-180"><ArrowLeft size={18} /></button>
    </div>
  );
  return (
    <>
      <div className="mt-4">{nav}</div>
      <div className="grid gap-4 mt-4">
        {days.map((d) => {
          const list = (byDay.get(d) ?? []).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
          const past = d < today;
          const rooms = (['red', 'green'] as const).filter((r) => !list.some((g) => g.room === r));
          return (
            <section key={d} aria-label={dayTitle(d)} className={cx(past && 'opacity-50')}>
              <div className="flex items-baseline gap-2 mb-1.5">
                <h2 className={cx('text-[15px] font-semibold', d === today ? 'text-sand-light' : 'text-cream')}>{dayTitle(d)}</h2>
                {d === today && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-sand text-moss-deep font-semibold">сегодня</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {games === null ? [0, 1].map((i) => <div key={i} className="min-h-[7.5rem] rounded-2xl bg-moss-deep/50 animate-pulse" />) : (
                  <>
                    {/* красная комната всегда слева, зелёная справа */}
                    {[...list.map((g) => ({ room: g.room, t: g.starts_at, el: <Tile key={g.id} g={g} /> })), ...rooms.map((r) => ({ room: r, t: '~', el: <EmptyTile key={r} room={r} day={d} past={past} staff={staff} /> }))]
                      .sort((a, b) => (a.room === b.room ? a.t.localeCompare(b.t) : a.room === 'red' ? -1 : 1)).map((x) => x.el)}
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <button onClick={() => shift(1)} className="w-full h-12 mt-5 rounded-2xl border border-sand/60 text-sand-light font-medium inline-flex items-center justify-center gap-2">Следующая неделя<ArrowLeft size={17} className="rotate-180" /></button>
    </>
  );
}

function List({ say }: { say: (t: string) => void }) {
  const [games, setGames] = useState<Game[] | null>(null);
  const [room, setRoom] = useState<'' | 'red' | 'green'>('');
  const [when, setWhen] = useState<'all' | 'today' | 'week'>('all');
  const [sys, setSys] = useState('');
  useEffect(() => { api.games().then((r) => setGames(r.games)).catch((e) => { say((e as Error).message); setGames([]); }); }, [say]);
  const systems = useMemo(() => [...new Set((games ?? []).map((g) => g.system).filter(Boolean))], [games]);
  const now = Date.now();
  const list = (games ?? []).filter((g) => (!room || g.room === room) && (!sys || g.system === sys)
    && (when === 'all' || (when === 'today' ? fmtDay(g.starts_at) === fmtDay(new Date().toISOString()) : Date.parse(g.starts_at) - now < 7 * 86400000)));
  const chip = (on: boolean) => cx('h-8 px-3 rounded-full text-xs border shrink-0', on ? 'bg-sand text-moss-deep border-sand font-medium' : 'border-moss-light text-cream/80');
  return (
    <>
      <div className="flex gap-1.5 mt-4 overflow-x-auto no-scrollbar">
        {([['all', 'Все дни'], ['today', 'Сегодня'], ['week', 'Неделя']] as const).map(([k, t]) => <button key={k} className={chip(when === k)} onClick={() => setWhen(k)}>{t}</button>)}
        <span className="w-px bg-moss-light/60 mx-0.5 shrink-0" />
        {([['', 'Все комнаты'], ['red', 'Красная'], ['green', 'Зелёная']] as const).map(([k, t]) => <button key={k} className={chip(room === k)} onClick={() => setRoom(k)}>{t}</button>)}
      </div>
      {systems.length > 1 && <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar"><button className={chip(!sys)} onClick={() => setSys('')}>Все игры</button>{systems.map((s) => <button key={s} className={chip(sys === s)} onClick={() => setSys(s)}>{s}</button>)}</div>}
      <div className="grid gap-3 mt-4">
        {games === null && [0, 1].map((i) => <div key={i} className="h-72 rounded-3xl bg-moss-deep/60 animate-pulse" />)}
        {games && !list.length && <div className="py-10 text-center text-cream/60 text-sm">{games.length ? 'По этим фильтрам игр нет.' : 'Скоро здесь появятся новые игры. Загляните позже или спросите в чате клуба.'}</div>}
        {list.map((g) => <Card key={g.id} g={g} />)}
      </div>
    </>
  );
}

function My() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [guest, setGuest] = useState(false);
  useEffect(() => { api.me().then((m) => { setGuest(!m.user); setGames(m.games ?? []); }).catch(() => setGames([])); }, []);
  if (guest) return <div className="mt-6 text-sm text-cream/70">Откройте приложение из Telegram, чтобы видеть свои записи.</div>;
  return (
    <div className="grid gap-3 mt-4">
      {games === null && <div className="h-40 rounded-3xl bg-moss-deep/60 animate-pulse" />}
      {games && !games.length && <div className="py-10 text-center text-cream/60 text-sm">Вы пока никуда не записаны. Загляните во вкладку «Игры».</div>}
      {games?.map((g) => <Card key={g.id} g={g} />)}
    </div>
  );
}

function Links() {
  return (
    <section className="mt-8">
      <div className="grid gap-2">
        <button onClick={() => openLink(SITES.builder)} className="h-14 rounded-2xl bg-gradient-to-b from-sand-light to-sand text-moss-deep font-semibold inline-flex items-center justify-center gap-2"><Sparkles size={19} />Билдер персонажа</button>
        <button onClick={() => openLink(SITES.sheet)} className="h-14 rounded-2xl bg-moss border border-sand/60 text-sand-light font-semibold inline-flex items-center justify-center gap-2"><ScrollText size={19} />Заполнить лист персонажа</button>
      </div>
      <div className="text-xs text-cream/50 mt-5 mb-2 text-center">Наши сайты и каналы</div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => openLink(SITES.sheet)} className="h-11 rounded-xl border border-moss-light text-sm text-cream/85">Сайт листов</button>
        <button onClick={() => openLink(SITES.builder)} className="h-11 rounded-xl border border-moss-light text-sm text-cream/85">Сборка персонажа</button>
        {LINKS.map((l) => <button key={l.u} onClick={() => openLink(l.u)} className="h-11 rounded-xl border border-moss-light text-sm text-cream/85">{l.t}</button>)}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ страница игры

function GamePage({ id, say, role }: { id: number; say: (t: string) => void; role: Role }) {
  const [d, setD] = useState<{ game: Game; players: Player[]; canEdit: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [guest, setGuest] = useState('');
  const load = useCallback(() => api.game(id).then(setD).catch((e) => say((e as Error).message)), [id, say]);
  useEffect(() => { void load(); }, [load]);
  const g = d?.game;
  const closed = !g || g.status === 'cancelled' || Date.parse(g.starts_at) <= Date.now();
  const action = useCallback(async () => {
    if (!g || busy) return;
    if (role === 'guest') { say('Откройте приложение из Telegram, чтобы записаться'); return; }
    setBusy(true);
    try {
      if (g.mine) { if (!(await confirmBox(g.mine === 'main' ? 'Отменить запись? Место отдадим следующему из очереди.' : 'Выйти из листа ожидания?'))) return; await api.leave(g.id); haptic('light'); say('Запись отменена'); }
      else { const r = await api.join(g.id); haptic('success'); say(r.status === 'main' ? 'Вы записаны! Бот напомнит об игре.' : `Мест нет — вы в листе ожидания, место ${r.position}`); }
      await load();
    } catch (e) { haptic('error'); say((e as Error).message); } finally { setBusy(false); }
  }, [g, busy, role, say, load]);
  const label = !g ? '' : g.mine === 'main' ? 'Отменить запись' : g.mine === 'wait' ? 'Выйти из очереди' : free(g) ? 'Записаться' : 'В лист ожидания';
  // большая нижняя кнопка Telegram
  const act = useRef(action); act.current = action;
  useEffect(() => {
    if (!tg || !g) return;
    const f = () => void act.current();
    if (closed) { tg.MainButton.hide(); return; }
    tg.MainButton.setParams({ text: label, color: g.mine ? '#3a4a40' : '#aa9173', text_color: g.mine ? '#e8dfcf' : '#1f2521' }).show().onClick(f);
    if (busy) tg.MainButton.showProgress(); else tg.MainButton.hideProgress();
    return () => { tg?.MainButton.offClick(f); tg?.MainButton.hide(); };
  }, [g, closed, label, busy]);
  if (!d || !g) return <div className="py-16 text-center text-cream/60">Загружаю…</div>;
  const main = d.players.filter((p) => p.status === 'main'); const wait = d.players.filter((p) => p.status === 'wait');
  const toggleAtt = async (p: Player) => { await api.act(g.id, 'attended', { user_id: p.user_id, value: !p.attended }); void load(); };
  return (
    <div className="pb-6">
      {!tg && <button onClick={() => go('')} className="mt-3 mb-2 inline-flex items-center gap-1.5 text-sm text-cream/75"><ArrowLeft size={16} />Все игры</button>}
      <div className="relative -mx-4 aspect-[16/10] bg-moss mt-1">
        {g.image_id ? <img src={imgUrl(g.image_id)} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 grid place-items-center"><img src={`${ROOT}icons/icon-192.png`} alt="" className="w-28 opacity-40" /></div>}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#1f2521] to-transparent" />
      </div>
      <div className="-mt-10 relative">
        <Room room={g.room} />
        <h1 className="font-display-sc text-3xl text-sand-light leading-tight mt-2">{g.title}</h1>
        {g.status === 'cancelled' && <div className="mt-2 rounded-xl bg-red-500/15 border border-red-400/40 px-3 py-2 text-sm text-red-200">Игра отменена</div>}
        <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
          {([['Когда', `${fmtDay(g.starts_at)}, ${fmtTime(g.starts_at)}`], ['Мастер', g.master_name || '—'], ['Система', g.system || '—'], ['Сеттинг', g.setting || '—'], ...(g.level ? [['Уровень', g.level]] : []), ['Длительность', `≈ ${Math.round(g.duration_min / 60 * 10) / 10} ч`], ...(g.price ? [['Стоимость', g.price]] : [])] as [string, string][]).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-moss-deep/70 border border-moss-light/60 px-3 py-2"><div className="text-[11px] text-cream/55">{k}</div><div className="text-cream leading-snug">{v}</div></div>
          ))}
        </div>
        {g.description && <p className="mt-4 text-[15px] text-cream/85 leading-relaxed whitespace-pre-line">{g.description}</p>}
        <div className="mt-5 flex items-center justify-between"><div className="text-sm text-sand-light inline-flex items-center gap-1.5"><Users size={16} />Игроки</div><Seats g={g} big /></div>
        <div className="text-xs text-cream/60 mt-1">{seatText(g)}</div>
        <div className="grid gap-1.5 mt-2">
          {Array.from({ length: g.seats }, (_, i) => main[i]).map((p, i) => (
            <div key={i} className={cx('flex items-center gap-2 rounded-xl px-3 h-10 text-sm border', p ? 'bg-moss-deep/70 border-moss-light/60' : 'border-dashed border-moss-light/50 text-cream/40')}>
              <span className="w-5 text-cream/40 text-xs">{i + 1}</span>
              <span className="flex-1 truncate">{p ? p.name : 'свободно'}{p?.username ? <span className="text-cream/45"> · @{p.username}</span> : null}</span>
              {d.canEdit && p?.user_id !== undefined && (
                <>
                  <button aria-label={`Пришёл: ${p.name}`} onClick={() => toggleAtt(p)} className={cx('text-xs px-2 h-7 rounded-lg border', p.attended ? 'bg-sand text-moss-deep border-sand' : 'border-moss-light text-cream/60')}>{p.attended ? 'пришёл' : 'отметить'}</button>
                  <button aria-label={`Убрать: ${p.name}`} onClick={async () => { if (await confirmBox(`Убрать ${p.name} из игры?`)) { await api.act(g.id, 'kick', { user_id: p.user_id }); void load(); } }} className="text-cream/50 p-1"><X size={16} /></button>
                </>
              )}
            </div>
          ))}
          {main.length > g.seats && main.slice(g.seats).map((p) => <div key={p.name} className="text-xs text-cream/60">+ {p.name}</div>)}
        </div>
        {wait.length > 0 && <div className="mt-3"><div className="text-xs text-cream/55 mb-1">Лист ожидания</div>{wait.map((p, i) => <div key={i} className="text-sm text-cream/75 flex items-center gap-2 h-8">{i + 1}. {p.name}{d.canEdit && p.user_id !== undefined && <button aria-label={`Убрать: ${p.name}`} onClick={async () => { await api.act(g.id, 'kick', { user_id: p.user_id }); void load(); }} className="text-cream/50 ml-auto"><X size={15} /></button>}</div>)}</div>}
        {!tg && !closed && <Btn tone={g.mine ? 'base' : 'gold'} className="w-full mt-5 h-12" disabled={busy} onClick={action}>{busy ? '…' : label}</Btn>}
        {closed && g.status !== 'cancelled' && <div className="mt-5 text-sm text-cream/60 text-center">Запись закрыта — игра уже началась.</div>}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <Btn className="text-sm" onClick={() => openLink(SITES.builder)}><Sparkles size={16} />Собрать персонажа</Btn>
          <Btn className="text-sm" onClick={() => openLink(SITES.sheet)}><ScrollText size={16} />Заполнить лист</Btn>
        </div>
        {d.canEdit && (
          <div className="mt-6 rounded-2xl border border-moss-light p-3 grid gap-2">
            <div className="text-sm text-sand-light inline-flex items-center gap-1.5"><Crown size={15} />Управление игрой</div>
            <div className="grid grid-cols-2 gap-2">
              <Btn className="text-sm" onClick={() => go(`edit/${g.id}`)}>Изменить</Btn>
              <Btn className="text-sm" onClick={() => go(`copy/${g.id}`)}>Дублировать</Btn>
            </div>
            <div className="flex gap-2"><TextIn aria-label="Имя гостя" placeholder="Записать гостя без Telegram" value={guest} onChange={(e) => setGuest(e.target.value)} /><Btn disabled={!guest.trim()} onClick={async () => { await api.act(g.id, 'add', { name: guest }); setGuest(''); void load(); }}><Plus size={16} /></Btn></div>
            {g.status === 'open'
              ? <Btn tone="danger" className="text-sm" onClick={async () => { if (await confirmBox('Отменить игру? Всем записанным придёт сообщение.')) { await api.act(g.id, 'cancel'); say('Игра отменена, игроки оповещены'); void load(); } }}>Отменить игру</Btn>
              : <Btn className="text-sm" onClick={async () => { await api.act(g.id, 'reopen'); void load(); }}>Вернуть игру</Btn>}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ управление

function Admin({ role, say }: { role: Role; say: (t: string) => void }) {
  const [games, setGames] = useState<Game[]>([]);
  const [roles, setRoles] = useState<{ username: string }[]>([]);
  const [nu, setNu] = useState('');
  const loadRoles = useCallback(() => { if (role === 'admin') api.roles().then((r) => setRoles(r.roles)).catch(() => {}); }, [role]);
  useEffect(() => { api.games().then((r) => setGames(r.games)).catch(() => {}); loadRoles(); }, [loadRoles]);
  return (
    <div className="mt-4 grid gap-3">
      <Btn tone="gold" className="h-12" onClick={() => go('new')}><Plus size={18} />Новая игра</Btn>
      <div className="text-sm text-sand-light mt-2">Ближайшие игры</div>
      {games.map((g) => (
        <button key={g.id} onClick={() => go(`game/${g.id}`)} className="text-left rounded-2xl border border-moss-light bg-moss-deep/60 px-3 py-2.5">
          <div className="text-cream">{g.title}{g.status === 'cancelled' && <span className="text-red-300 text-xs"> · отменена</span>}</div>
          <div className="text-xs text-cream/60">{fmtDay(g.starts_at)}, {fmtTime(g.starts_at)} · {g.room === 'green' ? 'зелёная' : 'красная'} · {g.taken}/{g.seats}{g.waiting ? ` +${g.waiting} в очереди` : ''}</div>
        </button>
      ))}
      {!games.length && <div className="text-sm text-cream/55">Игр пока нет.</div>}
      {role === 'admin' && (
        <div className="mt-4 rounded-2xl border border-moss-light p-3">
          <div className="text-sm text-sand-light mb-1">Мастера</div>
          <div className="text-xs text-cream/60 mb-2">Мастер может создавать игры и управлять своими. Впишите его username в Telegram.</div>
          <div className="flex gap-2"><TextIn aria-label="Username мастера" placeholder="@username" value={nu} onChange={(e) => setNu(e.target.value)} /><Btn disabled={!nu.trim()} onClick={async () => { try { await api.setRole(nu, 'master'); setNu(''); loadRoles(); say('Мастер добавлен'); } catch (e) { say((e as Error).message); } }}><Plus size={16} /></Btn></div>
          <div className="grid gap-1 mt-2">{roles.map((r) => <div key={r.username} className="flex items-center text-sm h-9 px-2 rounded-lg bg-moss-deep/60">@{r.username}<button aria-label={`Убрать мастера ${r.username}`} className="ml-auto text-cream/50" onClick={async () => { await api.setRole(r.username, null); loadRoles(); }}><X size={15} /></button></div>)}</div>
        </div>
      )}
    </div>
  );
}

/** Сжимает фото до 1280 px по длинной стороне и JPEG — чтобы картинка весила 100–300 КБ. */
async function compress(file: File): Promise<{ mime: string; data: string; url: string }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.82);
  return { mime: 'image/jpeg', data: url.split(',')[1]!, url };
}

function Edit({ id, copy, day, room, say }: { id?: number; copy?: number; day?: string; room?: 'red' | 'green'; say: (t: string) => void }) {
  const [f, setF] = useState<Partial<Game>>({ room: room ?? 'red', seats: 6, duration_min: 240, system: 'D&D 2014' });
  const [when, setWhen] = useState(day ? `${day}T18:00` : '');
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [other, setOther] = useState(false);
  useEffect(() => {
    const src = id ?? copy; if (!src) return;
    api.game(src).then(({ game }) => {
      const { id: _i, taken: _t, waiting: _w, mine: _m, status: _s, ...rest } = game;
      setF(rest); setWhen(copy ? '' : toLocal(game.starts_at)); setPreview(imgUrl(game.image_id)); setOther(!!game.system && !SYSTEMS.includes(game.system));
    }).catch((e) => say((e as Error).message));
  }, [id, copy, say]);
  const set = (p: Partial<Game>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!f.title?.trim() || !when) { say('Нужны название, дата и время'); return; }
    setBusy(true);
    try {
      const body = { ...f, starts_at: toIso(when) };
      if (id) { await api.update(id, body); say('Сохранено'); go(`game/${id}`); }
      else { const r = await api.create(body); haptic('success'); say('Игра опубликована'); go(`game/${r.id}`); }
    } catch (e) { say((e as Error).message); } finally { setBusy(false); }
  };
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="pb-8">
      {!tg && <button onClick={() => history.back()} className="mt-3 inline-flex items-center gap-1.5 text-sm text-cream/75"><ArrowLeft size={16} />Назад</button>}
      <h1 className="font-display-sc text-2xl text-sand-light mt-3 mb-3">{id ? 'Изменить игру' : 'Новая игра'}</h1>
      <div className="grid gap-3">
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
          try { setBusy(true); const c = await compress(file); setPreview(c.url); const r = await api.image(c.mime, c.data); set({ image_id: r.id }); } catch (err) { say((err as Error).message || 'Не удалось загрузить картинку'); } finally { setBusy(false); }
        }} />
        <button onClick={() => input.current?.click()} className="relative aspect-[16/9] rounded-2xl border border-dashed border-sand/50 bg-moss-deep/60 overflow-hidden grid place-items-center text-sm text-cream/70">
          {preview ? <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <span className="inline-flex items-center gap-2"><ImagePlus size={18} />Картинка игры</span>}
        </button>
        <Field label="Название"><TextIn value={f.title ?? ''} onChange={(e) => set({ title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Дата и время (Астрахань)"><input aria-label="Дата и время" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full h-11 px-2 rounded-xl bg-moss-deep border border-moss-light text-cream" /></Field>
          <Field label="Длительность, часов"><TextIn inputMode="decimal" value={String((f.duration_min ?? 240) / 60)} onChange={(e) => set({ duration_min: Math.max(1, Math.round((parseFloat(e.target.value.replace(',', '.')) || 0) * 60)) })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['red', 'green'] as const).map((r) => <button key={r} onClick={() => set({ room: r })} className={cx('h-11 rounded-xl border text-sm font-medium', f.room === r ? (r === 'red' ? 'bg-red-500/30 border-red-400 text-red-100' : 'bg-emerald-500/30 border-emerald-400 text-emerald-100') : 'border-moss-light text-cream/70')}>{r === 'red' ? 'Красная комната' : 'Зелёная комната'}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Мастер"><TextIn value={f.master_name ?? ''} onChange={(e) => set({ master_name: e.target.value })} /></Field>
          <Field label="Его @username"><TextIn value={f.master_username ?? ''} placeholder="@username" onChange={(e) => set({ master_username: e.target.value })} /></Field>
        </div>
        <Field label="Система / редакция">
          <select aria-label="Система" value={other ? '__other' : f.system ?? ''} onChange={(e) => { if (e.target.value === '__other') { setOther(true); set({ system: '' }); } else { setOther(false); set({ system: e.target.value }); } }} className="w-full h-11 px-2 rounded-xl bg-moss-deep border border-moss-light text-cream">
            {SYSTEMS.map((s) => <option key={s}>{s}</option>)}<option value="__other">Другая…</option>
          </select>
        </Field>
        {other && <TextIn aria-label="Своя система" placeholder="Название системы" value={f.system ?? ''} onChange={(e) => set({ system: e.target.value })} />}
        <Field label="Сеттинг"><TextIn value={f.setting ?? ''} placeholder="Например: Забытые королевства, стимпанк" onChange={(e) => set({ setting: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Мест"><TextIn inputMode="numeric" value={String(f.seats ?? 6)} onChange={(e) => set({ seats: Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)) })} /></Field>
          <Field label="Уровень"><TextIn value={f.level ?? ''} placeholder="3" onChange={(e) => set({ level: e.target.value })} /></Field>
          <Field label="Цена"><TextIn value={f.price ?? ''} placeholder="бесплатно" onChange={(e) => set({ price: e.target.value })} /></Field>
        </div>
        <Field label="Описание"><textarea value={f.description ?? ''} onChange={(e) => set({ description: e.target.value })} className="w-full min-h-36 p-3 rounded-xl bg-moss-deep border border-moss-light outline-none text-[15px]" /></Field>
        <Btn tone="gold" className="h-12" disabled={busy} onClick={save}>{busy ? 'Сохраняю…' : id ? 'Сохранить' : 'Опубликовать игру'}</Btn>
      </div>
    </div>
  );
}
