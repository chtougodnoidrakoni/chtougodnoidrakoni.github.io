/** Иллюстрации стилей: украшения по краям страницы и водяные знаки в больших текстовых блоках. */
import type { SheetTheme } from './model';

const A = (n: string) => `${import.meta.env.BASE_URL}art/${n}.webp`;

/** x, y, w в миллиметрах; flip — отразить по горизонтали, flipY — по вертикали */
type Deco = { n: string; x: number; y: number; w: number; flip?: boolean; flipY?: boolean; o?: number };

const DECO: Partial<Record<SheetTheme, Deco[]>> = {
  fae: [
    { n: 'fae-top', x: 50, y: 2.2, w: 110 },
    { n: 'fae-left', x: 1.6, y: 70, w: 7.2 },
    { n: 'fae-left', x: 201.2, y: 70, w: 7.2, flip: true },
    { n: 'fae-butterfly', x: 64, y: 285.6, w: 9 },
    { n: 'fae-butterfly', x: 137, y: 285.6, w: 9, flip: true },
  ],
  dark: [
    { n: 'dark-top', x: 52, y: 1, w: 106 },
    { n: 'dark-left', x: 0.8, y: 120, w: 9.6 },
    { n: 'dark-left', x: 199.6, y: 120, w: 9.6, flip: true },
    { n: 'dark-bats', x: 60, y: 285.2, w: 11 },
    { n: 'dark-bats', x: 139, y: 285.2, w: 11, flip: true },
  ],
  slavic: [
    { n: 'slavic-stripL', x: 30, y: 2, w: 44 },
    { n: 'slavic-birdL', x: 80, y: 1, w: 22 },
    { n: 'slavic-birdR', x: 108, y: 1, w: 22 },
    { n: 'slavic-stripL', x: 136, y: 2, w: 44, flip: true },
    { n: 'slavic-cornerTL', x: 1, y: 1, w: 13 },
    { n: 'slavic-cornerTL', x: 196, y: 1, w: 13, flip: true },
    { n: 'slavic-cornerTL', x: 1, y: 283, w: 13, flipY: true },
    { n: 'slavic-cornerTL', x: 196, y: 283, w: 13, flip: true, flipY: true },
    { n: 'slavic-rhombus', x: 62, y: 285.4, w: 6 },
    { n: 'slavic-rhombus', x: 142, y: 285.4, w: 6 },
  ],
  eldritch: [
    { n: 'coc-top', x: 45, y: 1.5, w: 120 },
    { n: 'coc-vertical', x: 1.2, y: 110, w: 8.4 },
    { n: 'coc-vertical', x: 200.4, y: 110, w: 8.4, flip: true },
  ],
};

/** водяные знаки — по очереди для больших текстовых блоков */
export const WATERMARKS: Partial<Record<SheetTheme, string[]>> = {
  fae: ['fae-castle', 'fae-tree', 'fae-fairy', 'fae-deer', 'fae-door', 'fae-mushrooms', 'fae-books', 'fae-moon', 'fae-crystals', 'fae-lily', 'fae-potion', 'fae-wand'],
  dark: ['dark-castle', 'dark-dragon', 'dark-skull', 'dark-raven', 'dark-tree', 'dark-book', 'dark-chalice', 'dark-sword', 'dark-crystals', 'dark-mountains', 'dark-potion'],
  slavic: ['slavic-tree', 'slavic-church', 'slavic-firebird', 'slavic-sun', 'slavic-bear', 'slavic-idol', 'slavic-rowan', 'slavic-horn', 'slavic-oak', 'slavic-mushrooms'],
  eldritch: ['coc-cthulhu', 'coc-lighthouse', 'coc-ship', 'coc-tentacle', 'coc-book', 'coc-compass', 'coc-sigil', 'coc-wave'],
};

export const DIVIDER: Partial<Record<SheetTheme, string>> = { fae: 'fae-bottom', dark: 'dark-bottom', slavic: 'slavic-bottom', eldritch: 'coc-bottom' };
export const artUrl = A;

export function ThemeArt({ theme }: { theme: SheetTheme }) {
  const list = DECO[theme];
  if (!list) return null;
  return (
    <div className="theme-art" aria-hidden>
      {list.map((d, i) => (
        <img key={i} src={A(d.n)} alt="" style={{ left: `calc(var(--u) * ${d.x})`, top: `calc(var(--u) * ${d.y})`, width: `calc(var(--u) * ${d.w})`, opacity: d.o, transform: d.flip || d.flipY ? `scale(${d.flip ? -1 : 1}, ${d.flipY ? -1 : 1})` : undefined }} />
      ))}
    </div>
  );
}

/** Выбор водяного знака: блоку достаётся картинка по его порядку на листе. */
export function watermarkFor(theme: SheetTheme, idx: number): string | undefined {
  const l = WATERMARKS[theme];
  return l ? A(l[idx % l.length]!) : undefined;
}
