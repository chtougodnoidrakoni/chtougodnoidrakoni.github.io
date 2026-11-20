"""Переносит русский перевод в public/spells.json.
names.json — названия; text/*.json — {id: {"t": описание, "m": материалы}}.
Время, дистанция и длительность переводятся правилами ниже."""
import json, re, glob, os
ROOT = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(ROOT, '..', '..', 'public', 'spells.json')
d = json.load(open(P))
names = json.load(open(os.path.join(ROOT, 'names.json')))
text = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'text', '*.json'))):
    text.update(json.load(open(f)))

def plural(n, one, few, many):
    n = abs(int(n)) % 100
    if 11 <= n <= 14: return many
    n %= 10
    return one if n == 1 else few if 2 <= n <= 4 else many

UNITS = {'minute': ('минута', 'минуты', 'минут'), 'hour': ('час', 'часа', 'часов'), 'day': ('день', 'дня', 'дней'), 'round': ('раунд', 'раунда', 'раундов'), 'mile': ('миля', 'мили', 'миль')}
def amount(s):
    def rep(m):
        n, u = m.group(1), m.group(2).lower().rstrip('s')
        return f"{n} {plural(n, *UNITS[u])}"
    return re.sub(r'(\d+)\s+(minutes?|hours?|days?|rounds?|miles?)', rep, s, flags=re.I)

SPECIAL_TIME = {
 'Bonus Action, which you take immediately after hitting a target with a Melee weapon or an Unarmed Strike': 'Бонусное действие, сразу после попадания по цели рукопашным оружием или безоружным ударом',
 'Bonus Action, which you take immediately after hitting a creature with a Melee weapon or an Unarmed Strike': 'Бонусное действие, сразу после попадания по существу рукопашным оружием или безоружным ударом',
 'Bonus Action, which you take immediately after hitting a creature with a weapon': 'Бонусное действие, сразу после попадания по существу оружием',
 'Reaction, which you take when you see a creature within 60 feet of yourself casting a spell with Verbal, Somatic, or Material components': 'Реакция, когда вы видите, как существо в пределах 60 футов накладывает заклинание с вербальным, соматическим или материальным компонентом',
 'Reaction, which you take when you or a creature you can see within 60 feet of you falls': 'Реакция, когда вы или видимое вами существо в пределах 60 футов падает',
 'Reaction, which you take in response to taking damage from a creature that you can see within 60 feet of yourself': 'Реакция, когда видимое вами существо в пределах 60 футов наносит вам урон',
 'Reaction, which you take when you are hit by an attack roll or targeted by the Magic Missile spell': 'Реакция, когда по вам попадают броском атаки или вы становитесь целью «Волшебной стрелы»',
 'Action (Overgrowth) or 8 hours (Enrichment)': 'Действие (заросли) или 8 часов (плодородие)',
}
def tr_time(t):
    if t in SPECIAL_TIME: return SPECIAL_TIME[t]
    k = t.lower()
    if k in ('action', '1 action'): return 'Действие'
    if k in ('bonus action', '1 bonus action'): return 'Бонусное действие'
    if k in ('reaction', '1 reaction'): return 'Реакция'
    return amount(t)
def tr_range(r):
    m = {'self': 'На себя', 'touch': 'Касание', 'sight': 'В пределах видимости', 'special': 'Особая', 'unlimited': 'Неограниченная'}
    if r in m: return m[r]
    r = re.sub(r'(\d+) ft', r'\1 фт.', r)
    return amount(r)
def tr_dur(s):
    k = s.lower()
    if k == 'instantaneous': return 'Мгновенная'
    if k == 'special': return 'Особая'
    if k == 'until dispelled': return 'Пока не рассеется'
    if k == 'until dispelled or triggered': return 'Пока не рассеется или не сработает'
    s = re.sub(r'^(concentration\s+)?up to\s+', 'Концентрация, вплоть до ', s, flags=re.I)
    return amount(s)

done = 0
for s in d:
    s['ru'] = names.get(s['name'], s.get('ru'))
    s['rt'], s['rr'], s['rd'] = tr_time(s['time']), tr_range(s['range']), tr_dur(s['dur'])
    t = text.get(s['id'])
    if t:
        s['rtext'] = t['t']
        if t.get('m'): s['rm'] = t['m']
        done += 1
missing = sorted({s['name'] for s in d if not s.get('ru')})
json.dump(d, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
print(f'названия: {len(d) - len(missing)}/{len(d)}; описания: {done}/{len(d)}', missing[:10])
