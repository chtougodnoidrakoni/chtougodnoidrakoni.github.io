import { useState } from 'react';
import { ClipboardPaste, Wand2 } from 'lucide-react';
import { Btn, Sheet } from './Panels';
import { applyAi, extractJson, templateFor } from './aiImport';
import type { GameSystem } from './model';
import { useStore } from './store';

/** Окно «Вставить ответ нейросети»: новый лист нужной игры или заполнение открытого. */
export function AiPaste({ open, onClose, game }: { open: boolean; onClose: () => void; game?: GameSystem }) {
  const st = useStore();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const close = () => { setText(''); setErr(''); onClose(); };
  const paste = async () => { try { setText(await navigator.clipboard.readText()); setErr(''); } catch { setErr('Не получилось вставить автоматически — нажмите в поле и выберите «Вставить».'); } };
  const run = async () => {
    const data = extractJson(text);
    if (!data) { setErr('Не нашёл в тексте блок данных. Скопируйте ответ нейросети целиком, вместе с блоком кода в конце.'); return; }
    if (game) {
      const { sheet, filled } = applyAi(templateFor(game), data, st.spells);
      const id = await st.create(sheet); close(); await st.open(id);
      st.say(`Лист заполнен: ${filled} полей. Проверьте и поправьте, если нужно`);
    } else if (st.sheet) {
      let n = 0;
      st.edit((s) => { const r = applyAi(s, data, st.spells); n = r.filled; return r.sheet; });
      close(); st.say(`Заполнено полей: ${n}. Проверьте и поправьте, если нужно`);
    }
  };
  return (
    <Sheet open={open} onClose={close} title="Ответ нейросети"
      footer={<div className="pb-3"><Btn tone="gold" className="w-full" disabled={!text.trim()} onClick={run}><Wand2 size={18} />{game ? 'Создать и заполнить лист' : 'Заполнить этот лист'}</Btn></div>}>
      <div className="grid gap-3">
        <p className="text-sm text-cream/75 leading-relaxed">Скопируйте ответ нейросети целиком и вставьте сюда. Сайт возьмёт блок данных из конца ответа и сам разнесёт значения по полям{game ? ' нового листа' : ' этого листа'}.</p>
        <Btn onClick={paste}><ClipboardPaste size={18} />Вставить из буфера</Btn>
        <textarea rows={9} value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder="Сюда вставляется ответ нейросети"
          className="w-full px-3 py-2.5 rounded-xl bg-moss-deep border border-moss-light text-cream outline-none focus:border-sand text-xs leading-relaxed font-mono resize-none" />
        {err && <p className="text-sm text-red-300">{err}</p>}
        <p className="text-xs text-cream/50">Если какие-то поля остались пустыми, впишите их вручную. Нейросеть иногда пропускает данные.</p>
      </div>
    </Sheet>
  );
}
