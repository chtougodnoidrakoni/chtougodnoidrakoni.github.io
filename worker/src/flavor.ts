/**
 * Тексты бота для игроков в духе D&D: каждый раз разные, чтобы не надоедали.
 * Подстановки: {name} — имя игрока, {title} — игра, {when} — день и время, {room} — комната.
 */
import { esc } from './telegram';
import type { Game } from './index';

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;
const DAYS = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
const pad = (n: number) => String(n).padStart(2, '0');
const local = (iso: string) => new Date(Date.parse(iso) + 4 * 3600_000);
export const whenText = (iso: string) => { const d = local(iso); return `в ${DAYS[d.getUTCDay()]}, ${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}, в ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
const timeText = (iso: string) => { const d = local(iso); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
const roomText = (g: Game) => (g.room === 'green' ? 'зелёная комната' : 'красная комната');
const fill = (t: string, g: Game, name: string) => t.replace(/\{name\}/g, esc(name)).replace(/\{title\}/g, `«${esc(g.title)}»`).replace(/\{when\}/g, whenText(g.starts_at)).replace(/\{time\}/g, timeText(g.starts_at)).replace(/\{room\}/g, roomText(g));

/** Полный анонс игры — как в канале. */
export function announce(g: Game): string {
  const row = (k: string, v?: string) => (v?.trim() ? `\n<b>${k}:</b> ${esc(v.trim())}` : '');
  const desc = g.description.split('\n').filter((l) => !/^\s*запись также/i.test(l)).join('\n').trim();
  return `📜 <b>${esc(g.title)}</b>\n🗓 ${whenText(g.starts_at)} · ${roomText(g)}`
    + row('Мастер', g.master_name) + row('Система', g.system) + row('Сеттинг', g.setting) + row('Уровень', g.level) + row('Стоимость', g.price)
    + (desc ? `\n<b>В двух словах:</b> ${esc(desc.length > 700 ? `${desc.slice(0, 697).trimEnd()}…` : desc)}` : '');
}

/** Жанр игры — чтобы тексты не звали «в поход на дракона» тех, кто идёт на Ктулху или детскую игру. */
export type Genre = 'kids' | 'horror' | 'cyber' | 'fantasy' | 'neutral';
export function genreOf(g: Pick<Game, 'title' | 'system' | 'setting'> & { description?: string; level?: string }): Genre {
  const t = `${g.system} ${g.setting} ${g.title} ${g.level ?? ''}`.toLowerCase();
  const all = `${t} ${(g.description ?? '').toLowerCase()}`;
  if (/детск|для детей|kids/.test(all)) return 'kids';
  if (/ктулху|cthulhu|лавкрафт|хоррор|ужас/.test(t)) return 'horror';
  if (/киберпанк|cyberpunk|sci-?fi|научн|космос|звёздн|звездн/.test(t)) return 'cyber';
  if (/d&d|dnd|днд|подземел|pathfinder|фэнтези|fantasy|клинки|blades|драккен|forgotten|забыт/.test(t)) return 'fantasy';
  return 'neutral';
}

const SIGNED: Record<Genre, string[]> = {
  fantasy: [
    '⚔️ {name}, твоё имя внесено в списки отряда! Гильдия ждёт тебя {when}.',
    '🛡 Свиток подписан, печать поставлена. {name}, ты в отряде, что выступает {when}.',
    '🐉 Трактирщик кивнул и записал тебя в книгу постояльцев, {name}. Приключение начнётся {when}.',
    '🗡 {name}, мастер раскладывает карты и уже отметил место для твоего героя. Сбор {when}.',
    '🔮 Кости брошены, судьба решена: {name}, ты идёшь в поход {when}.',
    '🍺 Кружка эля уже ждёт тебя в таверне, {name}. Встречаемся {when} — и в путь.',
  ],
  horror: [
    '🕯 {name}, твоё имя записано в старом журнале. Расследование начнётся {when}. Говорят, не все сыщики возвращаются в здравом уме.',
    '📰 {name}, в газете заметка о странных событиях, а в списке сыщиков теперь ты. Встречаемся {when}.',
    '🗝 Дверь в заброшенный особняк откроется {when}, {name}. Ты в группе тех, кто решился войти.',
  ],
  cyber: [
    '🌃 {name}, контракт подписан. Сбор команды {when}, неон уже горит.',
    '💾 {name}, твой профиль загружен в систему. Миссия стартует {when}.',
    '🔌 Фиксер на связи: {name}, ты в деле. Встречаемся {when}.',
  ],
  kids: [
    '🧸 {name}, запись на детскую игру есть! Юных героев ждём {when}.',
    '🌟 {name}, место для юного искателя приключений забронировано. Ждём {when}, будет весело.',
  ],
  neutral: [
    '🎲 {name}, ты записан на {title}! Ждём тебя {when}.',
    '🎲 Место за столом за тобой, {name}. Играем {when}.',
    '📜 {name}, твоё имя в списке игроков. Встречаемся {when}.',
  ],
};
const SIGNED_END = [
  'Вся дальнейшая информация по игре будет в нашем чате. Подписывайся, чтобы ничего не пропустить.',
  'Дальше все новости об игре будут в нашем чате. Вступай, там собираются все игроки.',
  'Переносы, новости и всё остальное по игре напишем в чате клуба. Подпишись, чтобы быть в курсе.',
];
const ADDED: Record<Genre, string[]> = {
  fantasy: ['📜 {name}, хранитель гильдии вписал тебя в отряд! Ты идёшь {when}.', '⚔️ {name}, за тебя замолвили слово — ты в отряде. Сбор {when}.'],
  horror: ['🕯 {name}, администратор клуба вписал тебя в группу сыщиков. Расследование начнётся {when}.'],
  cyber: ['💾 {name}, админ внёс тебя в команду. Миссия стартует {when}.'],
  kids: ['🧸 {name}, администратор записал вас на детскую игру. Ждём {when}.'],
  neutral: ['🎲 {name}, администратор клуба записал тебя на {title}. Ждём {when}.'],
};
const WAIT: Record<Genre, string[]> = {
  fantasy: ['🕯 {name}, все места у костра заняты, но ты в листе ожидания — {pos}-й. Освободится место, и я тут же пришлю гонца.'],
  horror: ['🕯 {name}, группа сыщиков уже набрана, но ты {pos}-й в очереди. Если кто-то не решится войти, место твоё, я сразу напишу.'],
  cyber: ['⏳ {name}, команда уже собрана, ты {pos}-й в очереди. Освободится слот, и я тут же дам знать.'],
  kids: ['⏳ {name}, все места на детской игре заняты, вы {pos}-е в очереди. Освободится место, сразу напишу.'],
  neutral: ['⏳ {name}, все места на {title} заняты, ты {pos}-й в очереди. Освободится место, и я сразу напишу.'],
};

export const signedText = (g: Game, name: string, byAdmin = false) => `${fill(pick((byAdmin ? ADDED : SIGNED)[genreOf(g)]), g, name)}\n\n${announce(g)}\n\n${pick(SIGNED_END)}`;
export const waitText = (g: Game, name: string, pos: number) => fill(pick(WAIT[genreOf(g)]), g, name).replace(/\{pos\}/g, String(pos));
