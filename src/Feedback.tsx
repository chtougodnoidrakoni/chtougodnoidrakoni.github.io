import { useState } from 'react';
import { LifeBuoy, Lightbulb, Send } from 'lucide-react';
import { Btn, Field, Sheet, TextIn } from './Panels';
import { useStore } from './store';

declare const __BUILD__: string;
const TG = 'astrakhan_trener';
type Kind = 'support' | 'wish';

const GAMES = ['D&D 5e', 'Зов Ктулху', 'Клинки во тьме', 'Киберпанк RED', 'Сайт в целом'];
const WISH = ['Добавить', 'Изменить', 'Убрать'];

function device() {
  const ua = navigator.userAgent;
  const ios = ua.match(/OS (\d+)[._](\d+)/);
  const os = /iPhone|iPad/.test(ua) && ios ? `iOS ${ios[1]}.${ios[2]}` : /Android ([\d.]+)/.exec(ua)?.[0] ?? (navigator.platform || 'устройство');
  const app = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone ? 'иконка на экране' : 'браузер';
  const ver = new Date(Number(__BUILD__)).toLocaleDateString('ru-RU');
  return `${os}, ${app}, версия сайта от ${ver}`;
}

const store = { get: (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } } };

export function Feedback() {
  const [kind, setKind] = useState<Kind | null>(null);
  return (
    <div className="mt-5">
      <div className="text-sm text-cream/70 px-1 mb-2">Поддержка и пожелания</div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setKind('support')} className="h-10 rounded-xl bg-moss/70 border border-moss-light text-sm text-cream inline-flex items-center justify-center gap-2"><LifeBuoy size={16} className="text-sand-light" />Поддержка</button>
        <button onClick={() => setKind('wish')} className="h-10 rounded-xl bg-moss/70 border border-moss-light text-sm text-cream inline-flex items-center justify-center gap-2"><Lightbulb size={16} className="text-sand-light" />Пожелания</button>
      </div>
      <FeedbackSheet kind={kind} onClose={() => setKind(null)} />
    </div>
  );
}

function Chips({ list, value, onChange }: { list: string[]; value: string; onChange: (v: string) => void }) {
  return <div className="flex flex-wrap gap-2">{list.map((x) => <button key={x} onClick={() => onChange(value === x ? '' : x)} className={`px-3 h-9 rounded-full border text-sm ${value === x ? 'border-sand bg-sand/20 text-sand-light' : 'border-moss-light text-cream/80'}`}>{x}</button>)}</div>;
}

function FeedbackSheet({ kind, onClose }: { kind: Kind | null; onClose: () => void }) {
  const say = useStore((s) => s.say);
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');
  const [name, setName] = useState(() => store.get('fb-name'));
  const support = kind === 'support';
  const close = () => { setText(''); setTag(''); onClose(); };

  const send = () => {
    const body = text.trim();
    if (!body) { say(support ? 'Опишите, что случилось' : 'Напишите своё пожелание'); return; }
    store.set('fb-name', name.trim());
    const lines = support
      ? ['🛠 Поддержка · лист персонажа ЧУиД', tag && `Где: ${tag}`, '', body, '', name.trim() && `От: ${name.trim()}`, `Устройство: ${device()}`]
      : ['💡 Пожелание · лист персонажа ЧУиД', tag && `Что сделать: ${tag}`, '', body, '', name.trim() && `От: ${name.trim()}`];
    const msg = lines.filter((l): l is string => typeof l === 'string').join('\n').replace(/\n{3,}/g, '\n\n');
    navigator.clipboard?.writeText(msg).catch(() => {});
    const url = `https://t.me/${TG}?text=${encodeURIComponent(msg)}`;
    const w = window.open(url, '_blank');
    if (!w) location.href = url;
    say('Открываю Telegram. Текст уже скопирован, если что — просто вставьте');
    close();
  };

  return (
    <Sheet open={!!kind} onClose={close} title={support ? 'Поддержка' : 'Пожелания'}
      footer={<div className="pb-3"><Btn tone="gold" className="w-full" onClick={send}><Send size={18} />Отправить в Telegram</Btn></div>}>
      <div className="grid gap-4">
        <p className="text-sm text-cream/75 leading-relaxed">
          {support
            ? 'Что-то сломалось или работает не так? Опишите, что вы делали и что пошло не так. Если можно, приложите скриншот уже в Telegram.'
            : 'Чего не хватает на сайте? Что стоит поменять или убрать? Пишите как есть, читаю всё.'}
        </p>
        <div><div className="text-xs text-cream/60 mb-1.5 px-1">{support ? 'Где случилось' : 'Что сделать'}</div>
          <Chips list={support ? GAMES : WISH} value={tag} onChange={setTag} /></div>
        <Field label={support ? 'Что случилось' : 'Ваше пожелание'}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} autoFocus
            placeholder={support ? 'Например: нажимаю «PDF», крутится и ничего не происходит' : 'Например: добавить лист для «Подземелий и пёсиков»'}
            className="w-full px-3 py-2.5 rounded-xl bg-moss-deep border border-moss-light text-cream outline-none focus:border-sand resize-none leading-relaxed" />
        </Field>
        <Field label="Как к вам обращаться (необязательно)"><TextIn value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя или ник" /></Field>
        <p className="text-xs text-cream/50 leading-relaxed">Откроется Telegram с готовым сообщением для @{TG}, останется нажать «Отправить».{support && ' К обращению автоматически добавится модель системы и версия сайта, чтобы быстрее найти ошибку.'}</p>
      </div>
    </Sheet>
  );
}
