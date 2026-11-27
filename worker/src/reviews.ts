/**
 * Просьба об отзыве: на следующий день после игры каждому, кто был в основном составе, —
 * одно сообщение в духе D&D с кнопками 2ГИС и Яндекс Карт. Раз в день, днём.
 */
import { esc, type Send } from './telegram';
import type { Env } from './index';

export const REVIEW_2GIS = 'https://2gis.ru/astrakhan/firm/70000001111078348';
export const REVIEW_YANDEX = 'https://yandex.ru/maps/org/chto_ugodno_i_drakony/101909403177/';

const ASK = [
  '🍺 {name}, вчерашнее приключение «{title}» позади. Надеемся, кубы были к тебе благосклонны!\n\nЕсли понравилось, оставь пару слов о клубе. Для нас это как золото в сундуке после боя, и новым искателям приключений проще нас найти.',
  '📜 {name}, летописец клуба собирает истории о вчерашней игре «{title}».\n\nЗапиши и свою: короткий отзыв на картах очень помогает таверне расти. Займёт минуту, а мы будем благодарны, как спасённая деревня.',
  '🐉 {name}, дракон повержен, ну или как минимум ранен. Спасибо, что был с нами на «{title}»!\n\nЕсли игра зашла, черкни отзыв. Так о клубе узнают новые герои, а мастера увидят, что старались не зря.',
  '🕯 {name}, костёр после вчерашней игры «{title}» ещё тлеет.\n\nПоделись впечатлениями в отзыве, это лучшая награда для мастера и клуба. А мы уже готовим новые приключения.',
];
const fill = (t: string, name: string, title: string) => t.replace(/\{name\}/g, esc(name)).replace(/\{title\}/g, esc(title));
export const reviewText = (name: string, title: string, i = Math.floor(Math.random() * ASK.length)) => fill(ASK[i % ASK.length]!, name, title);
export const reviewBtns = { reply_markup: { inline_keyboard: [[{ text: '⭐ Отзыв в 2ГИС', url: REVIEW_2GIS }, { text: '⭐ Яндекс Карты', url: REVIEW_YANDEX }]] } };

/** Сколько сообщений ушло. Повторный запуск в тот же день ничего не шлёт. */
export async function askReviews(env: Env, send: Send, now: number) {
  const yesterday = new Date(now + 4 * 3600_000 - 864e5).toISOString().slice(0, 10);
  const fresh = await env.DB.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING RETURNING key').bind(`reviews:${yesterday}`, new Date(now).toISOString()).first();
  if (!fresh) return 0;
  const games = (await env.DB.prepare("SELECT id, title, starts_at FROM games WHERE status != 'cancelled' AND starts_at >= ? AND starts_at < ?")
    .bind(`${yesterday}T00:00`, `${new Date(Date.parse(`${yesterday}T12:00:00Z`) + 2 * 864e5).toISOString().slice(0, 10)}`).all<{ id: number; title: string; starts_at: string }>()).results
    .filter((g) => new Date(Date.parse(g.starts_at) + 4 * 3600_000).toISOString().slice(0, 10) === yesterday);
  const done = new Set<number>(); let n = 0;
  for (const g of games) {
    const rows = (await env.DB.prepare(`SELECT s.user_id, COALESCE(u.name, s.name) AS name FROM signups s JOIN users u ON u.id = s.user_id AND u.started = 1
      WHERE s.game_id = ? AND s.status = 'main' AND s.user_id > 0`).bind(g.id).all<{ user_id: number; name: string }>()).results;
    for (const r of rows) {
      if (done.has(r.user_id)) continue; done.add(r.user_id);
      await send(r.user_id, reviewText((r.name || 'приключенец').split(/\s+/)[0]!, g.title), reviewBtns).catch(() => undefined); n++;
    }
  }
  return n;
}
