/**
 * Автозаполнение листа ответом нейросети.
 * Промт просит нейросеть закончить ответ блоком JSON, ключи которого — подписи блоков нашего листа.
 * Здесь: шаблон этого блока для промта и разбор ответа обратно в лист.
 */
import { clubTemplate, uid, type Block, type GameSystem, type Sheet, type SpellData } from './model';
import { systemTemplate } from './systems';

export const templateFor = (g: GameSystem): Sheet => (g === 'dnd' ? clubTemplate() : systemTemplate(g));

const SKIP: Block['type'][] = ['emblem', 'qr', 'ornament', 'image', 'spells', 'pctlist', 'sumlist'];
const SKILLS_KEY = 'все_навыки';
const SPELLS_KEY = 'все_заклинания';
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/\(.*?\)/g, '').replace(/[^a-zа-я0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function blocksOf(s: Sheet) { return s.pages.flatMap((p) => p.blocks); }

/** Шаблон JSON для промта и пояснения к нему. */
export function aiSkeleton(g: GameSystem): string {
  const s = templateFor(g);
  const obj: Record<string, unknown> = {};
  const notes: string[] = [];
  const titles = new Set(s.pages.map((p) => p.title));
  for (const b of blocksOf(s)) {
    const l = b.label?.trim();
    if (!l || SKIP.includes(b.type) || l in obj) continue;
    if (b.type === 'title' && titles.has(l)) continue;
    if (b.type === 'text' && b.parts?.length) obj[l] = Object.fromEntries(b.parts.map((p) => [p, '']));
    else if (b.type === 'abilityx') {
      obj[l] = { значение: 10, спасбросок: false, навыки: [] };
      if (b.items?.length) notes.push(`${l}: ${b.items.map((i) => i.name).join(', ')}`);
    } else if (b.type === 'table') obj[l] = [b.columns ?? []].map((c) => c.map((x) => `<${x}>`));
    else if (b.type === 'circles') {
      if (/ячейк/i.test(l)) obj[l] = Object.fromEntries((b.rows ?? []).map((r) => [r.name, 0]));
      else if (g === 'bitd' && (b.rows ?? []).some((r) => r.count > 1)) obj[l] = Object.fromEntries((b.rows ?? []).filter((r) => r.count > 1).map((r) => [r.name, 0]));
    } else if (b.type === 'pctstat' || b.type === 'track') obj[l] = 0;
    else obj[l] = '';
  }
  const skills = blocksOf(s).filter((b) => b.type === 'pctlist' || b.type === 'sumlist').flatMap((b) => b.items ?? []).filter((i) => i.name && i.sub !== '#');
  if (skills.length) obj[SKILLS_KEY] = Object.fromEntries(skills.slice(0, 3).map((i) => [i.name, 0]));
  if (g === 'dnd') obj[SPELLS_KEY] = [{ название: 'Волшебная стрела (Magic Missile)', круг: 1, подготовлено: true }];

  const lines = [
    '',
    'В самом конце ответа выведи блок данных для автозаполнения моего листа на сайте: один блок кода ```json по шаблону ниже.',
    '— Ключи не меняй, не переводи и не удаляй. Если значения нет, оставь пустую строку "".',
    '— Числа пиши числами. Длинный текст пиши одной строкой, переносы — через \\n.',
    '— Таблицы — список строк, в каждой строке значения в том же порядке, что и колонки в шаблоне.',
  ];
  if (g === 'dnd') lines.push('— Для характеристик: «значение» — число, «спасбросок» — true, если есть владение, «навыки» — названия навыков с владением строго из списка ниже.', '— «Ячейки заклинаний» — сколько ячеек каждого круга. «все_заклинания» — каждое заклинание и заговор (заговор — круг 0) с русским названием и английским в скобках.');
  if (skills.length) lines.push(`— «${SKILLS_KEY}»: навык → итоговое значение. Перечисли все навыки, которые отличаются от нуля. Названия бери из этого списка: ${skills.map((i) => i.name).join(', ')}.`);
  if (g === 'bitd') lines.push('— Кружки (действия, стресс, монеты) — сколько точек закрашено.');
  if (notes.length) lines.push('Навыки по характеристикам:', ...notes.map((n) => `  ${n}`));
  lines.push('', '```json', JSON.stringify(obj, null, 1), '```');
  return lines.join('\n');
}

/** Достаёт JSON из ответа нейросети: из блока ```json или по первой и последней фигурной скобке. */
export function extractJson(text: string): Record<string, unknown> | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/g);
  const cands = [...(fence ?? []).map((f) => f.replace(/```(?:json)?/g, '').trim()).reverse()];
  const a = text.indexOf('{'), z = text.lastIndexOf('}');
  if (a >= 0 && z > a) cands.push(text.slice(a, z + 1));
  for (const c of cands) {
    for (const t of [c, c.replace(/,\s*([}\]])/g, '$1').replace(/[“”«»]/g, '"')]) {
      try { const o = JSON.parse(t); if (o && typeof o === 'object' && !Array.isArray(o)) return o as Record<string, unknown>; } catch { /* пробуем дальше */ }
    }
  }
  return null;
}

const str = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)).trim();
const num = (v: unknown) => { const n = parseInt(str(v), 10); return Number.isNaN(n) ? undefined : n; };

/** Заполняет лист данными. Возвращает новый лист и сколько полей заполнено. */
export function applyAi(sheet: Sheet, data: Record<string, unknown>, spellDb: SpellData[]): { sheet: Sheet; filled: number } {
  let filled = 0;
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(data)) map.set(norm(k), v);
  const used = new Set<string>();
  const skillsIn = (data[SKILLS_KEY] ?? data['навыки'] ?? {}) as Record<string, unknown>;
  const skillMap = new Map(Object.entries(typeof skillsIn === 'object' && skillsIn ? skillsIn : {}).map(([k, v]) => [norm(k), v]));
  const usedSkills = new Set<string>();

  const pages = sheet.pages.map((p) => ({
    ...p,
    blocks: p.blocks.map((b): Block => {
      if (b.type === 'pctlist' || b.type === 'sumlist') {
        if (!skillMap.size) return b;
        const items = (b.items ?? []).map((it) => {
          if (it.sub === '#' || !it.name) return it;
          const k = norm(it.name);
          const hit = [...skillMap.keys()].find((x) => x === k || x.startsWith(k) || k.startsWith(x));
          if (!hit) return it;
          const n = num(skillMap.get(hit)); if (n === undefined) return it;
          usedSkills.add(hit); filled++;
          return { ...it, value: String(n) };
        });
        return { ...b, items };
      }
      const key = norm(b.label ?? '');
      if (!key || !map.has(key) || used.has(key)) return b;
      const v = map.get(key);
      if (v === '' || v === null || v === undefined) return b;
      used.add(key);
      switch (b.type) {
        case 'title': case 'field': case 'stat': { const s = str(v); if (!s) return b; filled++; return { ...b, value: s }; }
        case 'pctstat': case 'track': { const n = num(v); if (n === undefined) return b; filled++; return { ...b, value: String(n) }; }
        case 'text': {
          if (b.parts?.length) {
            const o = typeof v === 'object' && v && !Array.isArray(v) ? (v as Record<string, unknown>) : { [b.parts[0]!]: v };
            const om = new Map(Object.entries(o).map(([k, x]) => [norm(k), str(x)]));
            const values = b.parts.map((t, i) => om.get(norm(t)) || (i === 0 && om.size === 1 ? [...om.values()][0] : '') || b.values?.[i] || '');
            filled++; return { ...b, values };
          }
          const s = Array.isArray(v) ? v.map(str).join('\n') : typeof v === 'object' ? Object.entries(v as object).map(([k, x]) => `${k}: ${str(x)}`).join('\n') : str(v).replace(/\\n/g, '\n');
          if (!s) return b; filled++; return { ...b, value: s };
        }
        case 'abilityx': {
          const o = (typeof v === 'object' && v ? v : { значение: v }) as Record<string, unknown>;
          const score = num(o['значение'] ?? o['score']);
          const save = o['спасбросок'] ?? o['save'];
          const sk = (Array.isArray(o['навыки']) ? o['навыки'] : []).map((x) => norm(str(x)));
          filled++;
          return {
            ...b,
            score: score !== undefined ? String(score) : b.score,
            save: b.save ? { ...b.save, checked: save === true || save === 'true' || save === 'да' } : b.save,
            items: (b.items ?? []).map((it) => ({ ...it, checked: sk.some((x) => x === norm(it.name) || x.startsWith(norm(it.name))) })),
          };
        }
        case 'table': {
          if (!Array.isArray(v)) return b;
          const cols = b.columns?.length ?? 1;
          const rows = (v as unknown[]).filter((r) => !(Array.isArray(r) && r.every((c) => /^<.*>$/.test(str(c)))))
            .map((r) => (Array.isArray(r) ? r : typeof r === 'object' && r ? Object.values(r) : [r]).map(str).slice(0, cols));
          if (!rows.length) return b;
          const old = b.cells ?? [];
          const cells = Array.from({ length: Math.max(old.length, rows.length) }, (_, i) => Array.from({ length: cols }, (_, j) => rows[i]?.[j] ?? (rows.length > i ? '' : old[i]?.[j] ?? '')));
          filled++; return { ...b, cells };
        }
        case 'circles': {
          if (typeof v !== 'object' || !v) return b;
          const om = new Map(Object.entries(v as object).map(([k, x]) => [norm(k), num(x)]));
          const slots = /ячейк/i.test(b.label);
          filled++;
          return { ...b, rows: (b.rows ?? []).map((r) => { const n = om.get(norm(r.name)); return n === undefined ? r : slots ? { ...r, count: Math.max(0, Math.min(9, n)), filled: 0 } : { ...r, filled: Math.max(0, Math.min(r.count, n)) }; }) };
        }
        default: return b;
      }
    }),
  }));

  // навыки, которых нет на листе, — в пустые строки
  const rest = [...skillMap.entries()].filter(([k]) => !usedSkills.has(k));
  if (rest.length) {
    const orig = Object.entries(skillsIn as object);
    for (const pg of pages) for (const b of pg.blocks) if (b.type === 'pctlist') {
      b.items = (b.items ?? []).map((it) => {
        if (it.name || it.sub === '#' || !rest.length) return it;
        const [k] = rest.shift()!; const o = orig.find(([n]) => norm(n) === k);
        filled++; return { ...it, name: o?.[0] ?? k, value: str(o?.[1]) };
      });
    }
  }

  // заклинания
  let spells = sheet.spells;
  const sp = data[SPELLS_KEY] ?? data['заклинания'];
  if (Array.isArray(sp) && sp.length) {
    const byName = new Map<string, SpellData>();
    for (const s of spellDb) { byName.set(norm(s.name), s); if (s.ru) byName.set(norm(s.ru), s); }
    const add = [...spells];
    for (const it of sp) {
      const o = (typeof it === 'object' && it ? it : { название: it }) as Record<string, unknown>;
      const name = str(o['название'] ?? o['name']); if (!name) continue;
      const en = name.match(/\(([^)]+)\)/)?.[1];
      const found = (en && byName.get(norm(en))) || byName.get(norm(name));
      if (found && add.some((x) => x.ref === found.id)) continue;
      const prepared = o['подготовлено'] === true;
      if (found) add.push({ key: uid(), ref: found.id, prepared });
      else add.push({ key: uid(), prepared, custom: { id: `custom:${uid()}`, ed: '2014', src: 'нейросеть', name: name.replace(/\s*\(.*\)/, ''), lvl: num(o['круг'] ?? o['level']) ?? 0, school: '', time: '', range: '', v: 0, s: 0, dur: '', c: 0, r: 0, cls: [], text: '' } });
      filled++;
    }
    spells = add;
  }
  return { sheet: { ...sheet, pages, spells }, filled };
}
