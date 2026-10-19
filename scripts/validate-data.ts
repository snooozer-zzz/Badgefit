/**
 * Checks every data file and the badge art on disk.
 *
 *   npm run data:validate   -> report problems (exit code 1 if there are errors)
 *   npm run data:sync       -> also flips status todo -> redrawn when art exists in public/badges
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { BadgeSchema, CategorySchema, UniformSchema } from '../src/data/schema';

const root = resolve(import.meta.dirname, '..');
const fix = process.argv.includes('--fix');
const read = (p: string): unknown => JSON.parse(readFileSync(join(root, p), 'utf8'));

const errors: string[] = [];
const warnings: string[] = [];

const categories = z.array(CategorySchema).parse(read('src/data/categories.json'));
const badges = z.array(BadgeSchema).parse(read('src/data/badges.json'));
const uniformDir = join(root, 'src/data/uniforms');
const uniforms = readdirSync(uniformDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, data: UniformSchema.parse(JSON.parse(readFileSync(join(uniformDir, f), 'utf8'))) }));

const categoryIds = new Set(categories.map((c) => c.id));

// Badges
const seen = new Set<string>();
let changed = false;
for (const b of badges) {
  const key = `${b.category}/${b.slug}`;
  if (seen.has(key)) errors.push(`Duplicate badge ${key}`);
  seen.add(key);
  if (!categoryIds.has(b.category)) errors.push(`${key}: unknown category "${b.category}"`);

  const art = join(root, 'public/badges', b.category, `${b.slug}.png`);
  const hasArt = existsSync(art);
  if (b.status !== 'todo' && !hasArt) errors.push(`${key}: status is "${b.status}" but public/badges/${key}.png is missing`);
  if (b.status === 'todo' && hasArt) {
    if (fix) {
      b.status = 'redrawn';
      changed = true;
      console.log(`  synced ${key}: todo -> redrawn`);
    } else {
      warnings.push(`${key}: art exists but status is "todo" (run npm run data:sync)`);
    }
  }
  if (b.status === 'verified' && !b.sizeVerified) warnings.push(`${key}: verified but sizeVerified is false`);
}
if (changed) writeFileSync(join(root, 'src/data/badges.json'), JSON.stringify(badges, null, 2) + '\n');

// Uniforms
for (const { file, data } of uniforms) {
  if (!existsSync(join(root, 'public', data.image))) errors.push(`${file}: image public/${data.image} is missing`);
  const anchorIds = new Set<string>();
  for (const a of data.anchors) {
    if (anchorIds.has(a.id)) errors.push(`${file}: duplicate anchor ${a.id}`);
    anchorIds.add(a.id);
    for (const c of a.accepts) if (!categoryIds.has(c)) errors.push(`${file}: anchor ${a.id} accepts unknown category "${c}"`);
    if (a.x < 0 || a.x > data.width || a.y < 0 || a.y > data.height) errors.push(`${file}: anchor ${a.id} is outside the image`);
    if (!a.verified) warnings.push(`${file}: anchor ${a.id} position not verified`);
  }
  for (const c of categories) {
    if (c.wornOn && !data.anchors.some((a) => a.accepts.includes(c.id))) {
      warnings.push(`${file}: no anchor for category "${c.id}" (worn: ${c.wornOn})`);
    }
  }
}

// Summary
const byStatus = new Map<string, number>();
for (const b of badges) byStatus.set(b.status, (byStatus.get(b.status) ?? 0) + 1);
console.log(`Badges: ${badges.length} (${[...byStatus].map(([s, n]) => `${n} ${s}`).join(', ')})`);
console.log(`Uniforms: ${uniforms.map((u) => u.data.id).join(', ')}`);
if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n  ` + warnings.join('\n  '));
if (errors.length) {
  console.error(`\nErrors (${errors.length}):\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log('\nData OK.');
