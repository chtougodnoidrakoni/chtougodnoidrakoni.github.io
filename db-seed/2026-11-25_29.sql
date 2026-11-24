-- Игры с 25 по 29 ноября из канала клуба. Повторный запуск ничего не дублирует.
INSERT INTO games(title, starts_at, duration_min, room, master_name, setting, system, level, price, seats, description, created_by, created_at)
SELECT 'Великий путь', '2026-11-25T19:00:00+04:00', 240, 'red', 'Коля', 'Дарк фэнтези', '', '5', '1200 ₽ за игру 4–5 часов', 6, 'Страшная война мышинцев и котовцев привела к ужасным последствиям. Что скрывают пески, луна и почему это важно для вас?

Запись также у @oh_katiakaterina', 'seed', '2026-11-24T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE starts_at = '2026-11-25T19:00:00+04:00' AND room = 'red' AND title = 'Великий путь');
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900000, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-25T19:00:00+04:00' AND room = 'red' AND title = 'Великий путь' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900001, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-25T19:00:00+04:00' AND room = 'red' AND title = 'Великий путь' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900002, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-25T19:00:00+04:00' AND room = 'red' AND title = 'Великий путь' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900003, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-25T19:00:00+04:00' AND room = 'red' AND title = 'Великий путь' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900004, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-25T19:00:00+04:00' AND room = 'red' AND title = 'Великий путь' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900005, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-25T19:00:00+04:00' AND room = 'red' AND title = 'Великий путь' ON CONFLICT DO NOTHING;
INSERT INTO games(title, starts_at, duration_min, room, master_name, setting, system, level, price, seats, description, created_by, created_at)
SELECT 'Волчий пастырь', '2026-11-26T19:00:00+04:00', 240, 'red', 'Катя', 'Славянский, расследование', '', '3, ваншот, можно новичкам', '1200 ₽ за игру 4–5 часов', 6, 'Где-то в лесах потеряна проклятая деревня и её бессмертные (если верить легендам) жители. Вечная жизнь — дар или проклятье? Это вам и предстоит выяснить

Запись также у @oh_katiakaterina', 'seed', '2026-11-24T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE starts_at = '2026-11-26T19:00:00+04:00' AND room = 'red' AND title = 'Волчий пастырь');
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900100, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-26T19:00:00+04:00' AND room = 'red' AND title = 'Волчий пастырь' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900101, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-26T19:00:00+04:00' AND room = 'red' AND title = 'Волчий пастырь' ON CONFLICT DO NOTHING;
INSERT INTO games(title, starts_at, duration_min, room, master_name, setting, system, level, price, seats, description, created_by, created_at)
SELECT 'Между молотом и наковальней. Пламя разгорается', '2026-11-27T19:00:00+04:00', 240, 'green', 'Вова', '', '', '7, кампания', '1200 ₽ за игру 4–5 часов', 6, 'Запись также у @oh_katiakaterina', 'seed', '2026-11-24T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE starts_at = '2026-11-27T19:00:00+04:00' AND room = 'green' AND title = 'Между молотом и наковальней. Пламя разгорается');
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900200, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-27T19:00:00+04:00' AND room = 'green' AND title = 'Между молотом и наковальней. Пламя разгорается' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900201, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-27T19:00:00+04:00' AND room = 'green' AND title = 'Между молотом и наковальней. Пламя разгорается' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900202, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-27T19:00:00+04:00' AND room = 'green' AND title = 'Между молотом и наковальней. Пламя разгорается' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900203, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-27T19:00:00+04:00' AND room = 'green' AND title = 'Между молотом и наковальней. Пламя разгорается' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900204, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-27T19:00:00+04:00' AND room = 'green' AND title = 'Между молотом и наковальней. Пламя разгорается' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900205, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-27T19:00:00+04:00' AND room = 'green' AND title = 'Между молотом и наковальней. Пламя разгорается' ON CONFLICT DO NOTHING;
INSERT INTO games(title, starts_at, duration_min, room, master_name, setting, system, level, price, seats, description, created_by, created_at)
SELECT 'Фестиваль «Смех и Грех»', '2026-11-27T18:30:00+04:00', 240, 'red', 'Лёня', 'Мрачные сказки, расследование', '', '4', '1200 ₽ за игру 4–5 часов', 6, 'Отмечаем день рождения @nastyalxomchik 🎂

Мы рады сообщить каждому, до кого дойдёт эта весточка! В Пинвингсе будет проходить фестиваль «Смех и Грех!». Обещаем море эмоций и радости

Запись также у @oh_katiakaterina', 'seed', '2026-11-24T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE starts_at = '2026-11-27T18:30:00+04:00' AND room = 'red' AND title = 'Фестиваль «Смех и Грех»');
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900300, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-27T18:30:00+04:00' AND room = 'red' AND title = 'Фестиваль «Смех и Грех»' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900301, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-27T18:30:00+04:00' AND room = 'red' AND title = 'Фестиваль «Смех и Грех»' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900302, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-27T18:30:00+04:00' AND room = 'red' AND title = 'Фестиваль «Смех и Грех»' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900303, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-27T18:30:00+04:00' AND room = 'red' AND title = 'Фестиваль «Смех и Грех»' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900304, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-27T18:30:00+04:00' AND room = 'red' AND title = 'Фестиваль «Смех и Грех»' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900305, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-27T18:30:00+04:00' AND room = 'red' AND title = 'Фестиваль «Смех и Грех»' ON CONFLICT DO NOTHING;
INSERT INTO games(title, starts_at, duration_min, room, master_name, setting, system, level, price, seats, description, created_by, created_at)
SELECT 'Подземелья Драккенхейма', '2026-11-28T12:00:00+04:00', 240, 'green', 'Денис', 'Дарк фэнтези, мутации', '', '3, S-2, кампания, 3-я игра', '1200 ₽ за игру 4–5 часов', 6, 'Первая вылазка в руины Драккенхейма увенчалась успехом. Ратлинги были рады новым друзьям. Но куда двигаться дальше?

Запись также у @oh_katiakaterina', 'seed', '2026-11-24T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE starts_at = '2026-11-28T12:00:00+04:00' AND room = 'green' AND title = 'Подземелья Драккенхейма');
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900400, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T12:00:00+04:00' AND room = 'green' AND title = 'Подземелья Драккенхейма' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900401, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T12:00:00+04:00' AND room = 'green' AND title = 'Подземелья Драккенхейма' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900402, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T12:00:00+04:00' AND room = 'green' AND title = 'Подземелья Драккенхейма' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900403, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T12:00:00+04:00' AND room = 'green' AND title = 'Подземелья Драккенхейма' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900404, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T12:00:00+04:00' AND room = 'green' AND title = 'Подземелья Драккенхейма' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900405, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T12:00:00+04:00' AND room = 'green' AND title = 'Подземелья Драккенхейма' ON CONFLICT DO NOTHING;
INSERT INTO games(title, starts_at, duration_min, room, master_name, setting, system, level, price, seats, description, created_by, created_at)
SELECT 'Новое подземелье', '2026-11-28T12:00:00+04:00', 240, 'red', 'Коля', 'Дарк фэнтези', '', '3', '1200 ₽ за игру 4–5 часов', 6, 'Около города Фейтун появилось новое подземелье. Почему над входом висит череп дракона, а в подземелье пахнет серой?

Запись также у @oh_katiakaterina', 'seed', '2026-11-24T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE starts_at = '2026-11-28T12:00:00+04:00' AND room = 'red' AND title = 'Новое подземелье');
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900500, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T12:00:00+04:00' AND room = 'red' AND title = 'Новое подземелье' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900501, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T12:00:00+04:00' AND room = 'red' AND title = 'Новое подземелье' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900502, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T12:00:00+04:00' AND room = 'red' AND title = 'Новое подземелье' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900503, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T12:00:00+04:00' AND room = 'red' AND title = 'Новое подземелье' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900504, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T12:00:00+04:00' AND room = 'red' AND title = 'Новое подземелье' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900505, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T12:00:00+04:00' AND room = 'red' AND title = 'Новое подземелье' ON CONFLICT DO NOTHING;
INSERT INTO games(title, starts_at, duration_min, room, master_name, setting, system, level, price, seats, description, created_by, created_at)
SELECT 'Всё дальше от Богов', '2026-11-28T18:00:00+04:00', 240, 'green', 'Маша', 'Расследование, путешествие', '', '8', '1200 ₽ за игру 4–5 часов', 6, 'После обнаружения каравана предстоит выяснить планы Барона.

Запись также у @oh_katiakaterina', 'seed', '2026-11-24T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE starts_at = '2026-11-28T18:00:00+04:00' AND room = 'green' AND title = 'Всё дальше от Богов');
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900600, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T18:00:00+04:00' AND room = 'green' AND title = 'Всё дальше от Богов' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900601, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T18:00:00+04:00' AND room = 'green' AND title = 'Всё дальше от Богов' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900602, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T18:00:00+04:00' AND room = 'green' AND title = 'Всё дальше от Богов' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900603, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T18:00:00+04:00' AND room = 'green' AND title = 'Всё дальше от Богов' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900604, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T18:00:00+04:00' AND room = 'green' AND title = 'Всё дальше от Богов' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900605, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T18:00:00+04:00' AND room = 'green' AND title = 'Всё дальше от Богов' ON CONFLICT DO NOTHING;
INSERT INTO games(title, starts_at, duration_min, room, master_name, setting, system, level, price, seats, description, created_by, created_at)
SELECT 'Лик вечности', '2026-11-28T18:00:00+04:00', 240, 'red', 'Коля', '', 'Зов Ктулху', 'Кампания', '1200 ₽ за игру 4–5 часов', 6, 'Аркхэм, 1927 год. Дожди, шедшие месяцы, поставили жителей Аркхэма перед выбором: бежать или остаться в затопляемом городе. По улицам стали ходить люди, призывающие остаться и покориться, «Ибо ОН грядет». Что же выберут те, кому ещё есть что потерять?

Запись также у @oh_katiakaterina', 'seed', '2026-11-24T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE starts_at = '2026-11-28T18:00:00+04:00' AND room = 'red' AND title = 'Лик вечности');
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900700, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T18:00:00+04:00' AND room = 'red' AND title = 'Лик вечности' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900701, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T18:00:00+04:00' AND room = 'red' AND title = 'Лик вечности' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900702, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T18:00:00+04:00' AND room = 'red' AND title = 'Лик вечности' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900703, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T18:00:00+04:00' AND room = 'red' AND title = 'Лик вечности' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900704, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T18:00:00+04:00' AND room = 'red' AND title = 'Лик вечности' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900705, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-28T18:00:00+04:00' AND room = 'red' AND title = 'Лик вечности' ON CONFLICT DO NOTHING;
INSERT INTO games(title, starts_at, duration_min, room, master_name, setting, system, level, price, seats, description, created_by, created_at)
SELECT 'Объятия матери', '2026-11-29T12:00:00+04:00', 240, 'green', 'Денис', 'Дарк фэнтези, аномалии, мутации', '', '4, ваншот, подходит новичкам', '1200 ₽ за игру 4–5 часов', 6, 'Цикл «Хроники Драккенхейма».

На окраине леса стоит старый приют, где даже спустя долгие годы в окнах горит тёплый свет, а из-за стен доносится детский смех. Говорят, здесь каждый потерянный ребёнок обретает дом

Запись также у @oh_katiakaterina', 'seed', '2026-11-24T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE starts_at = '2026-11-29T12:00:00+04:00' AND room = 'green' AND title = 'Объятия матери');
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900800, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T12:00:00+04:00' AND room = 'green' AND title = 'Объятия матери' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900801, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T12:00:00+04:00' AND room = 'green' AND title = 'Объятия матери' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900802, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T12:00:00+04:00' AND room = 'green' AND title = 'Объятия матери' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900803, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T12:00:00+04:00' AND room = 'green' AND title = 'Объятия матери' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900804, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T12:00:00+04:00' AND room = 'green' AND title = 'Объятия матери' ON CONFLICT DO NOTHING;
INSERT INTO games(title, starts_at, duration_min, room, master_name, setting, system, level, price, seats, description, created_by, created_at)
SELECT 'Проклятые души', '2026-11-29T12:00:00+04:00', 240, 'red', 'Витя', '', '', '1, кампания', '1200 ₽ за игру 4–5 часов', 6, 'Они смогли, выбрались из руин древнего города, но что теперь? Знания дали лишь новые вопросы, ценности — лишь возможность продолжать путь. А путь их лежит дальше, вглубь материка, наполненного миазмом

Запись также у @oh_katiakaterina', 'seed', '2026-11-24T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE starts_at = '2026-11-29T12:00:00+04:00' AND room = 'red' AND title = 'Проклятые души');
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900900, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T12:00:00+04:00' AND room = 'red' AND title = 'Проклятые души' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900901, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T12:00:00+04:00' AND room = 'red' AND title = 'Проклятые души' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900902, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T12:00:00+04:00' AND room = 'red' AND title = 'Проклятые души' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900903, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T12:00:00+04:00' AND room = 'red' AND title = 'Проклятые души' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900904, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T12:00:00+04:00' AND room = 'red' AND title = 'Проклятые души' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -900905, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T12:00:00+04:00' AND room = 'red' AND title = 'Проклятые души' ON CONFLICT DO NOTHING;
INSERT INTO games(title, starts_at, duration_min, room, master_name, setting, system, level, price, seats, description, created_by, created_at)
SELECT 'За гранью Сумеречного Света', '2026-11-29T18:00:00+04:00', 240, 'green', 'Настя', 'Фейвилд', '', '3, ваншот', '1200 ₽ за игру 4–5 часов', 6, 'Герои отправляются на карнавал Сумеречного света отыскать то, что они потеряли в детстве

Запись также у @oh_katiakaterina', 'seed', '2026-11-24T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE starts_at = '2026-11-29T18:00:00+04:00' AND room = 'green' AND title = 'За гранью Сумеречного Света');
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -901000, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T18:00:00+04:00' AND room = 'green' AND title = 'За гранью Сумеречного Света' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -901001, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T18:00:00+04:00' AND room = 'green' AND title = 'За гранью Сумеречного Света' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -901002, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T18:00:00+04:00' AND room = 'green' AND title = 'За гранью Сумеречного Света' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -901003, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T18:00:00+04:00' AND room = 'green' AND title = 'За гранью Сумеречного Света' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -901004, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T18:00:00+04:00' AND room = 'green' AND title = 'За гранью Сумеречного Света' ON CONFLICT DO NOTHING;
INSERT INTO signups(game_id, user_id, name, status, created_at) SELECT id, -901005, 'Записан(а) через канал', 'main', '2026-11-24T14:00:00.000Z' FROM games WHERE starts_at = '2026-11-29T18:00:00+04:00' AND room = 'green' AND title = 'За гранью Сумеречного Света' ON CONFLICT DO NOTHING;
INSERT INTO games(title, starts_at, duration_min, room, master_name, setting, system, level, price, seats, description, created_by, created_at)
SELECT 'Покрас миниатюрок', '2026-11-29T17:00:00+04:00', 120, 'red', 'Витя', 'Мастер-класс', '', '', '500 ₽', 8, 'С нас — материалы и Витя, который расскажет всё по технике. С вас — прийти.

Можно взять миниатюрку из нашего арсенала, но она останется у нас и будет участвовать в сюжетах. А можно принести свою и довести её до ума.

Длительность — 2 часа.

Запись также у @oh_katiakaterina', 'seed', '2026-11-24T14:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE starts_at = '2026-11-29T17:00:00+04:00' AND room = 'red' AND title = 'Покрас миниатюрок');
