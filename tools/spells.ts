/** Собирает public/spells.json из пакетов SRD A&D: компактная база заклинаний для листа. */
import { readFileSync, writeFileSync } from 'node:fs';
const src = process.argv[2] ?? '../anything-and-dragons/content/packages';
const out: unknown[] = [];
for (const [file, label] of [['srd-5-1', 'SRD 5.1'], ['srd-5-2', 'SRD 5.2']] as const) {
  const pkg = JSON.parse(readFileSync(`${src}/${file}.json`, 'utf8'));
  let ru: Record<string, string> = {};
  try { ru = Object.fromEntries(JSON.parse(readFileSync(`${src}/${file}-ru.json`, 'utf8')).entries.map((e: any) => [e.uid, e.name])); } catch {}
  for (const it of pkg.items) {
    if (it.type !== 'spell') continue;
    const m = it.mechanics;
    out.push({
      id: it.id, ed: pkg.edition, src: label, name: it.name, ...(ru[it.id] ? { ru: ru[it.id] } : {}),
      lvl: m.level, school: m.school, time: m.castingTime,
      range: m.range.kind === 'ranged' ? (m.range.feet >= 5280 ? `${m.range.feet / 5280} mile` : `${m.range.feet} ft`) : m.range.kind,
      v: m.components.v ? 1 : 0, s: m.components.s ? 1 : 0, ...(m.components.m ? { m: m.components.m } : {}),
      dur: m.duration, c: m.concentration ? 1 : 0, r: m.ritual ? 1 : 0,
      cls: m.classes.map((c: string) => c.split('/')[1]), text: it.text?.body ?? '',
    });
  }
}
writeFileSync('public/spells.json', JSON.stringify(out));
console.log(out.length, 'spells');
