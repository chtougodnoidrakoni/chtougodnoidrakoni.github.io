-- База записей клуба. Миграции идемпотентны: можно применять повторно.
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,            -- ISO с поясом, например 2026-11-28T18:00:00+04:00
  duration_min INTEGER NOT NULL DEFAULT 240,
  room TEXT NOT NULL DEFAULT 'red',   -- red | green
  master_name TEXT NOT NULL DEFAULT '',
  master_username TEXT NOT NULL DEFAULT '',
  setting TEXT NOT NULL DEFAULT '',
  system TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '',
  seats INTEGER NOT NULL DEFAULT 6,
  image_id INTEGER,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open', -- open | cancelled
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  reminded_day INTEGER NOT NULL DEFAULT 0,
  reminded_soon INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS games_start ON games(starts_at);
CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,               -- main | wait
  attended INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(game_id, user_id)
);
CREATE INDEX IF NOT EXISTS signups_game ON signups(game_id, status, created_at);
CREATE TABLE IF NOT EXISTS images (id INTEGER PRIMARY KEY AUTOINCREMENT, mime TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS roles (username TEXT PRIMARY KEY, role TEXT NOT NULL);
-- мастера клуба: имя на кнопке и ник в Телеграме; правят админы в приложении
CREATE TABLE IF NOT EXISTS masters (username TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL DEFAULT '', started INTEGER NOT NULL DEFAULT 0);

-- служебные отметки: какие напоминания уже ушли, какие недели выложены в канал
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- листы персонажей игроков: копия в облаке по Telegram-аккаунту
CREATE TABLE IF NOT EXISTS sheets (id TEXT NOT NULL, user_id INTEGER NOT NULL, name TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, id));

-- диалог «Составить расписание» в чате с ботом: на каком шаге администратор и что уже ввёл
CREATE TABLE IF NOT EXISTS bot_state (user_id INTEGER PRIMARY KEY, step TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
