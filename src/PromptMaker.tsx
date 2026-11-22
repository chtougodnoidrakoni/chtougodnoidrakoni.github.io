import { useState } from 'react';
import { Check, Copy, ExternalLink, Sparkles } from 'lucide-react';
import { Btn, Sheet } from './Panels';
import { SYSTEMS } from './systems';
import { buildPrompt, PROMPT_FIELDS } from './prompts';
import type { GameSystem } from './model';
import { useStore } from './store';

const inp = 'w-full h-11 px-3 rounded-xl bg-moss-deep border border-moss-light text-cream outline-none focus:border-sand';

export function PromptButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="h-11 rounded-xl border border-sand/60 text-sand-light inline-flex items-center justify-center gap-2"><Sparkles size={18} />Промт для создания персонажа</button>
      <PromptSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function PromptSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const say = useStore((s) => s.say);
  const [game, setGame] = useState<GameSystem | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const close = () => { onClose(); setTimeout(() => { setGame(null); setPrompt(''); setVals({}); setCopied(false); }, 300); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); say('Промт скопирован'); }
    catch { say('Не получилось скопировать — выделите текст и скопируйте вручную'); }
  };
  const title = !game ? 'Промт для персонажа' : prompt ? 'Ваш промт готов' : SYSTEMS.find((g) => g.id === game)!.name;

  return (
    <Sheet open={open} onClose={close} title={title}
      footer={game && !prompt ? <div className="pb-3"><Btn tone="gold" className="w-full" onClick={() => setPrompt(buildPrompt(game, vals))}><Sparkles size={18} />Получить промт</Btn></div>
        : prompt ? <div className="pb-3 grid grid-cols-2 gap-2"><Btn onClick={() => setPrompt('')}>Изменить</Btn><Btn tone="gold" onClick={copy}>{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? 'Скопировано' : 'Скопировать'}</Btn></div> : undefined}>
      {!game && (
        <div className="grid gap-3">
          <p className="text-sm text-cream/75 leading-relaxed">Не знаете, как заполнить лист? Опишите героя, а сайт соберёт запрос для нейросети. Она распишет персонажа по порядку, как поля стоят на листе, и останется только переписать значения.</p>
          <div className="text-xs text-cream/60 px-1">Выберите игру</div>
          <div className="grid grid-cols-2 gap-2">
            {SYSTEMS.map((g) => <button key={g.id} onClick={() => setGame(g.id)} className={`rounded-xl border p-3 text-left ${g.id === 'dnd' ? 'border-sand/70 bg-sand/15' : 'border-moss-light bg-moss-deep'}`}><div className="font-display-sc text-lg text-cream leading-tight">{g.name}</div></button>)}
          </div>
        </div>
      )}
      {game && !prompt && (
        <div className="grid gap-3" ref={(el) => el?.scrollIntoView({ block: 'start' })}>
          <button className="text-sm text-sand-light text-left" onClick={() => setGame(null)}>← другая игра</button>
          <p className="text-xs text-cream/60 leading-relaxed">Заполните, что знаете. Пустые поля нейросеть заполнит сама.</p>
          {PROMPT_FIELDS[game].map((f) => {
            const val = vals[f.id] ?? '';
            const set = (v: string) => setVals((s) => ({ ...s, [f.id]: v }));
            return (
              <label key={f.id} className="block">
                <div className="text-xs text-cream/60 mb-1 px-1">{f.label}</div>
                {f.kind === 'select'
                  ? <select className={inp} value={val || f.options![0]} onChange={(e) => set(e.target.value)}>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
                  : f.kind === 'area'
                    ? <textarea rows={3} className={`${inp} h-auto py-2.5 resize-none leading-relaxed`} placeholder={f.hint} value={val} onChange={(e) => set(e.target.value)} />
                    : <input className={inp} inputMode={f.kind === 'number' ? 'numeric' : undefined} list={f.options ? `pl-${f.id}` : undefined} placeholder={f.hint} value={val} onChange={(e) => set(e.target.value)} />}
                {f.options && f.kind !== 'select' && (
                  <>
                    <datalist id={`pl-${f.id}`}>{f.options.map((o) => <option key={o} value={o} />)}</datalist>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">{f.options.map((o) => <button key={o} type="button" onClick={() => set(o)} className={`px-2.5 h-8 rounded-full border text-xs ${val === o ? 'border-sand bg-sand/20 text-sand-light' : 'border-moss-light text-cream/75'}`}>{o}</button>)}</div>
                  </>
                )}
              </label>
            );
          })}
        </div>
      )}
      {prompt && (
        <div className="grid gap-3 scroll-mt-4" ref={(el) => el?.scrollIntoView({ block: 'start' })}>
          <ol className="text-sm text-cream/85 leading-relaxed list-decimal pl-5 grid gap-1">
            <li>Нажмите «Скопировать».</li>
            <li>Откройте ChatGPT (рекомендуем) или другую нейросеть: DeepSeek, Gemini, GigaChat, Алису.</li>
            <li>Вставьте промт и отправьте. Получите готового персонажа.</li>
            <li>Вернитесь сюда, создайте лист нужной игры и перепишите значения в поля по порядку.</li>
          </ol>
          <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className="h-10 rounded-xl border border-moss-light text-cream/85 text-sm inline-flex items-center justify-center gap-2"><ExternalLink size={16} />Открыть ChatGPT</a>
          <textarea readOnly value={prompt} rows={12} className={`${inp} h-auto py-2.5 text-xs leading-relaxed font-mono`} onFocus={(e) => e.target.select()} />
          <p className="text-xs text-cream/50">Нейросеть иногда ошибается в правилах. Если что-то выглядит странно, спросите мастера.</p>
        </div>
      )}
    </Sheet>
  );
}
