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

const SIGNED = [
  '⚔️ {name}, твоё имя внесено в списки отряда! Гильдия ждёт тебя {when}.',
  '🛡 Свиток подписан, печать поставлена. {name}, ты в отряде, что выступает {when}.',
  '🐉 Трактирщик кивнул и записал тебя в книгу постояльцев, {name}. Приключение начнётся {when}.',
  '🗡 {name}, мастер раскладывает карты и уже отметил место для твоего героя. Сбор {when}.',
  '🔮 Кости брошены, судьба решена: {name}, ты идёшь в поход {when}.',
  '🏰 Ворота откроются для тебя {when}, {name}. Твоё место за столом приключенцев занято — тобой.',
  '📯 Глашатай прокричал твоё имя на площади, {name}! Отряд выступает {when}.',
  '🍺 Кружка эля уже ждёт тебя в таверне, {name}. Встречаемся {when} — и в путь.',
];
const SIGNED_END = [
  'Накануне пришлю ворона с напоминанием.',
  'Заточи клинок и проверь лист персонажа — я напомню ближе к делу.',
  'Если планы рухнут, как стены старой крепости, — отмени запись в приложении, место ждут другие.',
  'Перед походом напишу ещё раз, чтобы ты не заблудился в пути.',
];
const ADDED = [
  '📜 {name}, хранитель гильдии вписал тебя в отряд! Ты идёшь {when}.',
  '🛡 Администратор клуба поставил твою печать в списке, {name}. Поход назначен {when}.',
  '⚔️ {name}, за тебя замолвили слово — ты в отряде. Сбор {when}.',
];
const WAIT = [
  '🕯 {name}, все места у костра заняты, но ты в листе ожидания — {pos}-й. Освободится место, и я тут же пришлю гонца.',
  '⏳ Отряд на {title} уже полон, {name}. Ты {pos}-й в очереди у ворот — как только кто-то сойдёт с пути, место твоё.',
];
const DAY = [
  '🐉 {name}, завтра {time} твоя судьба ждёт тебя за столом. {title}, {room}. Не опаздывай — дракон ждать не станет.',
  '⚔️ Приключенец, помни: завтра в {time} начинается {title}. Проверь снаряжение, наточи меч и не забудь кубики. Мы в {room}.',
  '📯 {name}, гонец из гильдии! Завтра {time} — {title}. Твой отряд соберётся в {room}, и без тебя он не выступит.',
  '🔮 Оракул видел тебя во сне, {name}: завтра в {time}, {room}, {title}. Судьба королевства в твоих руках — и в твоих бросках.',
  '🏰 Завтра в {time} ворота откроются, {name}. {title} ждёт смельчаков — {room}. Если не сможешь прийти, отмени запись в приложении: место нужно другому герою.',
  '🍺 {name}, трактирщик уже протирает кружки. Завтра в {time} — {title}, {room}. Мастер готовит ловушки, а ты — готовь героя.',
  '🗺 Карта развёрнута, маршрут проложен. Завтра {time}, {name}, — {title}, {room}. Не забудь лист персонажа!',
];
const SOON = [
  '⏳ {name}, до начала {title} пара часов! Собирай кубики — {time}, {room}.',
  '🔥 Костёр разожжён, отряд собирается. {title} начнётся в {time}, {room}. Ждём тебя, {name}!',
  '⚔️ Скоро в бой, {name}! {title} — в {time}, {room}. Мастер уже раскладывает миниатюры.',
  '🐉 Дракон проснулся и смотрит на часы: {time}. {title}, {room}. Поспеши, {name}!',
];

export const signedText = (g: Game, name: string, byAdmin = false) => `${fill(pick(byAdmin ? ADDED : SIGNED), g, name)}\n\n${announce(g)}\n\n${pick(SIGNED_END)}`;
export const waitText = (g: Game, name: string, pos: number) => fill(pick(WAIT), g, name).replace(/\{pos\}/g, String(pos));
export const dayText = (g: Game, name: string) => fill(pick(DAY), g, name);
export const soonText = (g: Game, name: string) => fill(pick(SOON), g, name);
