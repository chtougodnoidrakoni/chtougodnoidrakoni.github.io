/**
 * PDF прямо в приложении, без системной печати Safari.
 * Каждая страница листа рисуется в картинку ~300 dpi и кладётся на лист A4.
 * Системная печать на iPhone часто молчит, а с экрана «Домой» не работает вовсе.
 */
import { getFontEmbedCSS, toJpeg } from 'html-to-image';
import { PDFDocument } from 'pdf-lib';

const A4 = { w: 595.28, h: 841.89 }; // в пунктах
const TARGET_PX = 2480; // ширина страницы в пикселях (≈300 dpi, как при обычной печати)

const skip = (n: HTMLElement) => !(n.classList?.contains('no-print') || n.classList?.contains('fs-ctl') || n.classList?.contains('handle'));

export async function buildPdf(onProgress: (done: number, total: number) => void): Promise<Uint8Array> {
  const pages = [...document.querySelectorAll<HTMLElement>('.page')];
  if (!pages.length) throw new Error('Нет страниц');
  await document.fonts?.ready;
  const fontEmbedCSS = await getFontEmbedCSS(pages[0]!);
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages.length; i++) {
    const node = pages[i]!;
    // Safari рисует страницу в экранном размере и потом растягивает картинку: тонкие линии
    // и маленькие кружки округляются до пикселей и выходят кривыми. Поэтому на время снимка
    // увеличиваем сам лист до печатного размера (≈12 точек на мм) и снимаем его 1:1.
    const prevU = node.style.getPropertyValue('--u');
    node.style.setProperty('--u', `${TARGET_PX / 210}px`);
    node.classList.add('pdf-shot');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const w = node.offsetWidth, h = node.offsetHeight;
    const opts = { pixelRatio: 1, width: w, height: h, canvasWidth: w, canvasHeight: h, quality: 0.93, backgroundColor: '#ffffff', fontEmbedCSS, filter: skip, cacheBust: false,
      style: { boxShadow: 'none', margin: '0', ['-webkit-text-size-adjust' as string]: '100%' } };
    // Safari иногда отдаёт пустую картинку с первого раза — первый проход прогревает
    let url: string;
    try {
      if (i === 0) await toJpeg(node, opts).catch(() => undefined);
      url = await toJpeg(node, opts);
    } finally {
      if (prevU) node.style.setProperty('--u', prevU); else node.style.removeProperty('--u');
      node.classList.remove('pdf-shot');
    }
    const img = await pdf.embedJpg(await (await fetch(url)).arrayBuffer());
    pdf.addPage([A4.w, A4.h]).drawImage(img, { x: 0, y: 0, width: A4.w, height: A4.h });
    onProgress(i + 1, pages.length);
  }
  return pdf.save();
}

/** Отдать файл: «Поделиться» (Файлы, Telegram, печать) или скачивание, если «Поделиться» нет. */
export async function sharePdf(bytes: Uint8Array, name: string) {
  const file = new File([bytes as Uint8Array<ArrayBuffer>], `${name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Лист персонажа'}.pdf`, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: file.name }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
