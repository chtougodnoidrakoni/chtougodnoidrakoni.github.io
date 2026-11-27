/**
 * Просьба об отзыве: на следующий день после игры каждому, кто был в основном составе, —
 * одно сообщение в духе D&D с кнопками 2ГИС и Яндекс Карт. Раз в день, днём.
 */
import { esc, type Send } from './telegram';
import type { Env } from './index';
import { genreOf, type Genre } from './flavor';

export const REVIEW_2GIS = 'https://2gis.ru/astrakhan/firm/70000001111078348';
export const REVIEW_YANDEX = 'https://yandex.ru/maps/org/chto_ugodno_i_drakony/101909403177/';

const ASK: Record<Genre, string[]> = {
  fantasy: [
    '🍺 {name}, вчерашнее приключение «{title}» позади. Надеемся, кубы были к тебе благосклонны!\n\nЕсли понравилось, оставь пару слов о клубе. Для нас это как золото в сундуке после боя, и новым искателям приключений проще нас найти.',
    '🐉 {name}, дракон повержен, ну или как минимум ранен. Спасибо, что был с нами на «{title}»!\n\nЕсли игра зашла, черкни отзыв. Так о клубе узнают новые герои, а мастера увидят, что старались не зря.',
    '📜 {name}, летописец клуба собирает истории о вчерашней игре «{title}».\n\nЗапиши и свою: короткий отзыв на картах очень помогает таверне расти.',
  ],
  horror: [
    '🕯 {name}, рассудок на месте? Надеемся, вчерашнее расследование «{title}» обошлось без последствий.\n\nЕсли понравилось, оставь пару слов о клубе. Так о нас узнают новые сыщики.',
    '📰 {name}, дело «{title}» закрыто. Спасибо, что были с нами!\n\nЕсли игра зацепила, черкни отзыв на картах, мастеру будет приятно.',
  ],
  cyber: [
    '🌃 {name}, вчерашний контракт «{title}» закрыт. Спасибо, что были в команде!\n\nЕсли зашло, оставь отзыв на картах. Так о клубе узнают новые игроки.',
  ],
  kids: [
    '🌟 {name}, спасибо, что были с нами на детской игре «{title}»! Надеемся, юным героям понравилось.\n\nЕсли всё прошло хорошо, оставьте пару слов о клубе. Другим родителям так проще нас найти.',
  ],
  neutral: [
    '🎲 {name}, спасибо, что были с нами вчера на «{title}»! Надеемся, игра понравилась.\n\nЕсли да, оставь пару слов о клубе на картах. Так о нас узнают новые игроки, а мастера увидят, что старались не зря.',
    '🎲 {name}, как тебе вчерашняя «{title}»?\n\nЕсли понравилось, черкни короткий отзыв о клубе. Займёт минуту, а нам очень поможет.',
  ],
};
const fill = (t: string, name: string, title: string) => t.replace(/\{name\}/g, esc(name)).replace(/\{title\}/g, esc(title));
export const reviewText = (name: string, title: string, genre: Genre = 'neutral', i = Math.floor(Math.random() * 10)) => { const a = ASK[genre]; return fill(a[i % a.length]!, name, title); };
export const reviewBtns = { reply_markup: { inline_keyboard: [[{ text: '⭐ Отзыв в 2ГИС', url: REVIEW_2GIS }, { text: '⭐ Яндекс Карты', url: REVIEW_YANDEX }]] } };

/** Сколько сообщений ушло. Повторный запуск в тот же день ничего не шлёт. */
export async function askReviews(env: Env, send: Send, now: number) {
  const yesterday = new Date(now + 4 * 3600_000 - 864e5).toISOString().slice(0, 10);
  const fresh = await env.DB.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING RETURNING key').bind(`reviews:${yesterday}`, new Date(now).toISOString()).first();
  if (!fresh) return 0;
  const games = (await env.DB.prepare("SELECT id, title, starts_at, system, setting, level, description FROM games WHERE status != 'cancelled' AND starts_at >= ? AND starts_at < ?")
    .bind(`${yesterday}T00:00`, `${new Date(Date.parse(`${yesterday}T12:00:00Z`) + 2 * 864e5).toISOString().slice(0, 10)}`).all<{ id: number; title: string; starts_at: string; system: string; setting: string; level: string; description: string }>()).results
    .filter((g) => new Date(Date.parse(g.starts_at) + 4 * 3600_000).toISOString().slice(0, 10) === yesterday);
  const done = new Set<number>(); let n = 0;
  for (const g of games) {
    const rows = (await env.DB.prepare(`SELECT s.user_id, COALESCE(u.name, s.name) AS name FROM signups s JOIN users u ON u.id = s.user_id AND u.started = 1
      WHERE s.game_id = ? AND s.status = 'main' AND s.user_id > 0`).bind(g.id).all<{ user_id: number; name: string }>()).results;
    for (const r of rows) {
      if (done.has(r.user_id)) continue; done.add(r.user_id);
      await send(r.user_id, reviewText((r.name || 'друг').split(/\s+/)[0]!, g.title, genreOf(g)), reviewBtns).catch(() => undefined); n++;
    }
  }
  return n;
}
