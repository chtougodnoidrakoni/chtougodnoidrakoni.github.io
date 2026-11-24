import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { setActive, subsFor, classesFor, validate, type PackIn } from '../src/builder/content';
import { emptyBuild, expertiseCount, problems, rule, proficientWeapon, type Build } from '../src/builder/engine';

// опубликованные пакеты клуба: всё, что лежит в public/content, должно проходить проверку и работать в сборке
const idx = JSON.parse(readFileSync('public/content/index.json', 'utf8')).packs as string[];
const packs = idx.map((f) => JSON.parse(readFileSync(`public/content/packs/${f}`, 'utf8')) as PackIn);
const mk = (p: Partial<Build>): Build => ({ ...emptyBuild(), ...p });

describe('общие пакеты клуба', () => {
  beforeAll(() => setActive(packs.map((pack) => ({ pack, enabled: true, importedAt: 0, origin: 'club' as const }))));
  it('каждый пакет проходит проверку', () => { for (const p of packs) expect(validate(p).errors, p.pack_id).toEqual([]); });
  it('подклассы не задваиваются', () => {
    for (const c of classesFor('2014')) { const names = subsFor('2014', c.id).map((s) => s.name.toLowerCase()); expect(new Set(names).size, c.id).toBe(names.length); }
  });
  it('у плута осталась компетентность, у воина — боевой стиль, у заклинателей — заклинания', () => {
    if (!classesFor('2014').find((c) => c.id === 'rogue')?.pack) return;
    expect(expertiseCount(mk({ level: 6, cls: 'rogue' }))).toBe(4);
    expect(problems(mk({ level: 1, cls: 'fighter' })).class?.join()).toMatch(/боевой стиль/);
    const base = { str: 10, dex: 14, con: 12, int: 16, wis: 16, cha: 16 } as Build['base'];
    for (const id of ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard', 'artificer']) {
      const r = rule(mk({ level: 5, cls: id, base }));
      if (classesFor('2014').some((c) => c.id === id)) { expect(r, id).toBeDefined(); expect(r!.spells, id).toBeGreaterThan(0); }
    }
    expect(proficientWeapon(mk({ cls: 'rogue' }), 'Рапира')).toBe(true);
    expect(proficientWeapon(mk({ cls: 'rogue' }), 'Кинжал')).toBe(true);
  });
});
