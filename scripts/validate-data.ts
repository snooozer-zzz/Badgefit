/**
 * Checks every data file and the badge art on disk.
 *
 *   npm run data:validate   -> report problems (exit code 1 if there are errors)
 *   npm run data:sync       -> also flips status todo -> redrawn when art exists in public/badges
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { BadgeSchema, CategorySchema, MountedSchema, OptionsSchema, UniformSchema } from '../src/data/schema';

const root = resolve(import.meta.dirname, '..');
const fix = process.argv.includes('--fix');
const read = (p: string): unknown => JSON.parse(readFileSync(join(root, p), 'utf8'));

const errors: string[] = [];
const warnings: string[] = [];

const categories = z.array(CategorySchema).parse(read('src/data/categories.json'));
const badges = z.array(BadgeSchema).parse(read('src/data/badges.json'));
const options = OptionsSchema.parse(read('src/data/options.json'));
const uniformDir = join(root, 'src/data/uniforms');
const uniforms = readdirSync(uniformDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, data: UniformSchema.parse(JSON.parse(readFileSync(join(uniformDir, f), 'utf8'))) }));

const categoryIds = new Set(categories.map((c) => c.id));
const serviceIds = new Set(options.services.map((x) => x.id));
const genderIds = new Set(options.genders.map((x) => x.id));
const dressIds = new Set(options.dresses.map((x) => x.id));

// Selection screen options
for (const c of [...options.rank.categories, ...options.rank.replacesBranch, options.branch.category]) {
  if (!categoryIds.has(c)) errors.push(`options.json: unknown category "${c}"`);
}

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
  for (const v of b.artVariants ?? []) {
    if (v.service !== undefined && !serviceIds.has(v.service)) errors.push(`${key}: art variant for unknown service "${v.service}"`);
    if (v.uniform !== undefined && !uniforms.some((u) => u.data.id === v.uniform)) errors.push(`${key}: art variant for unknown uniform "${v.uniform}"`);
    if (!existsSync(join(root, 'public', v.path))) errors.push(`${key}: art variant public/${v.path} is missing`);
  }
  if (b.status === 'verified' && !b.sizeVerified) warnings.push(`${key}: verified but sizeVerified is false`);
}
if (changed) writeFileSync(join(root, 'src/data/badges.json'), JSON.stringify(badges, null, 2) + '\n');

// Uniforms
const drawings = new Map<string, string>();
for (const { file, data } of uniforms) {
  if (file !== `${data.id}.json`) errors.push(`${file}: id "${data.id}" does not match the file name`);
  if (data.mountedFrom && !uniforms.some((u) => u.data.id === data.mountedFrom)) errors.push(`${file}: mountedFrom "${data.mountedFrom}" is not a uniform`);
  if (!dressIds.has(data.dress)) errors.push(`${file}: unknown dress "${data.dress}"`);
  for (const s of data.services) if (!serviceIds.has(s)) errors.push(`${file}: unknown service "${s}"`);
  for (const g of data.genders) if (!genderIds.has(g)) errors.push(`${file}: unknown gender "${g}"`);
  for (const s of data.services) {
    for (const g of data.genders) {
      const slot = `${data.dress} / ${s} / ${g}`;
      const other = drawings.get(slot);
      if (other) errors.push(`${file}: ${slot} is already drawn by ${other}`);
      drawings.set(slot, file);
    }
  }
  if (!existsSync(join(root, 'public', data.image))) errors.push(`${file}: image public/${data.image} is missing`);
  const anchorIds = new Set<string>();
  for (const a of data.anchors) {
    if (anchorIds.has(a.id)) errors.push(`${file}: duplicate anchor ${a.id}`);
    anchorIds.add(a.id);
    for (const c of a.accepts) if (!categoryIds.has(c)) errors.push(`${file}: anchor ${a.id} accepts unknown category "${c}"`);
    for (const other of [a.stackAbove?.anchor, a.inLineWith]) {
      if (other && !data.anchors.some((x) => x.id === other)) errors.push(`${file}: anchor ${a.id} refers to unknown anchor "${other}"`);
    }
    if (a.x < 0 || a.x > data.width || a.y < 0 || a.y > data.height) errors.push(`${file}: anchor ${a.id} is outside the image`);
    if (!a.verified) warnings.push(`${file}: anchor ${a.id} position not verified`);
  }
  for (const c of categories) {
    if (c.wornOn && !data.anchors.some((a) => a.accepts.includes(c.id))) {
      warnings.push(`${file}: no anchor for category "${c.id}" (worn: ${c.wornOn})`);
    }
  }
}

// Perspective sprites (imported from the badge-art-pipeline bundle: npm run art:import)
const mountedDir = join(root, 'src/data/mounted');
const badgeKeys = new Set(badges.map((b) => `${b.category}/${b.slug}`));
for (const f of existsSync(mountedDir) ? readdirSync(mountedDir).filter((x) => x.endsWith('.json')) : []) {
  const m = MountedSchema.parse(JSON.parse(readFileSync(join(mountedDir, f), 'utf8')));
  if (!uniforms.some((u) => u.data.id === m.uniform)) errors.push(`mounted/${f}: unknown uniform "${m.uniform}"`);
  if (m.service !== undefined && !serviceIds.has(m.service)) errors.push(`mounted/${f}: unknown service "${m.service}"`);
  for (const [key, slots] of Object.entries(m.items)) {
    if (!badgeKeys.has(key)) errors.push(`mounted/${f}: unknown badge ${key}`);
    for (const s of slots.flat()) {
      if (!existsSync(join(root, 'public', s.href))) errors.push(`mounted/${f}: ${key} sprite public/${s.href} is missing`);
    }
  }
  for (const b of badges) {
    const key = `${b.category}/${b.slug}`;
    if (b.status !== 'todo' && ['shoulder-boards', 'rank-insignia', 'gorgets'].includes(b.category) && !m.items[key]) {
      errors.push(`mounted/${f}: no perspective sprites for ${key} (re-export in badge-art-pipeline, then npm run art:import)`);
    }
  }
}

// Summary
const byStatus = new Map<string, number>();
for (const b of badges) byStatus.set(b.status, (byStatus.get(b.status) ?? 0) + 1);
console.log(`Badges: ${badges.length} (${[...byStatus].map(([s, n]) => `${n} ${s}`).join(', ')})`);
console.log(`Uniforms: ${uniforms.length} (${uniforms.map((u) => u.data.id).join(', ')})`);
const undrawn = options.dresses.flatMap((d) =>
  options.services.flatMap((sv) => options.genders.filter((g) => !drawings.has(`${d.id} / ${sv.id} / ${g.id}`)).map((g) => `${d.name} ${sv.name} ${g.name}`)),
);
if (undrawn.length) warnings.push(`not drawn yet (shown as "Not drawn yet" on the selection screen): ${undrawn.join(', ')}`);
if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n  ` + warnings.join('\n  '));
if (errors.length) {
  console.error(`\nErrors (${errors.length}):\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log('\nData OK.');
