/**
 * Записи с простым оформлением: **жирный**, *курсив*, __подчёркнутый__.
 * В тексте лежат пометки, на листе и в PDF — уже оформленный текст.
 */
import { useRef, useState, type CSSProperties, type RefObject } from 'react';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function renderRich(src: string): string {
  return esc(src)
    .replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>')
    .replace(/__([\s\S]+?)__/g, '<u>$1</u>')
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<i>$2</i>');
}
/** Убирает пометки — для мест, где оформление не показывается. */
export const plainRich = (s: string) => s.replace(/\*\*([\s\S]+?)\*\*/g, '$1').replace(/__([\s\S]+?)__/g, '$1').replace(/(^|[^*])\*([^*\n]+?)\*/g, '$1$2');

export type Mark = '**' | '*' | '__';
/** Оборачивает выделение пометкой; повторное нажатие на уже оформленное снимает её. */
export function applyMark(el: HTMLTextAreaElement, mark: Mark, onChange: (v: string) => void) {
  const v = el.value, a = el.selectionStart, z = el.selectionEnd, n = mark.length;
  const sel = v.slice(a, z);
  let next: string, ca: number, cz: number;
  if (v.slice(a - n, a) === mark && v.slice(z, z + n) === mark && !(mark === '*' && (v[a - n - 1] === '*' || v[z + n] === '*'))) {
    next = v.slice(0, a - n) + sel + v.slice(z + n); ca = a - n; cz = z - n;
  } else {
    next = v.slice(0, a) + mark + sel + mark + v.slice(z); ca = a + n; cz = z + n;
  }
  onChange(next);
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(ca, cz); });
}

export function FmtBar({ target, onChange, className }: { target: RefObject<HTMLTextAreaElement | null>; onChange: (v: string) => void; className?: string }) {
  const btn = (mark: Mark, label: string, style: CSSProperties, title: string) => (
    <button type="button" aria-label={title} title={title} style={style}
      onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()}
      onClick={() => target.current && applyMark(target.current, mark, onChange)}>{label}</button>
  );
  return (
    <div className={`fmt-bar no-print ${className ?? ''}`}>
      {btn('**', 'Ж', { fontWeight: 800 }, 'Жирный')}
      {btn('*', 'К', { fontStyle: 'italic' }, 'Курсив')}
      {btn('__', 'Ч', { textDecoration: 'underline' }, 'Подчёркнутый')}
    </div>
  );
}

/** Текст на странице листа: показывает оформление, по касанию превращается в поле с кнопками Ж К Ч. */
export function RichText({ value, editable, onChange, className, style }: { value: string; editable: boolean; onChange: (v: string) => void; className?: string; style?: CSSProperties }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  if (editable && editing) return (
    <>
      <FmtBar target={ref} onChange={onChange} className="fmt-float" />
      <textarea ref={ref} autoFocus className={className} style={style} value={value} onBlur={() => setEditing(false)} onChange={(e) => onChange(e.target.value)} />
    </>
  );
  return <div className={`${className ?? ''} rt`} style={style} onClick={editable ? () => setEditing(true) : undefined} dangerouslySetInnerHTML={{ __html: renderRich(value) }} />;
}
