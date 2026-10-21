// Checks every data file and the badge art on disk.
//
//   npm run data:validate   -> report problems (exit code 1 if there are errors)
//   npm run data:sync       -> also flips status todo -> redrawn when art exists in public/badges
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { BadgeSchema, CategorySchema, MountedSchema, OptionsSchema, UniformSchema } from '../src/data/schema';
import type { Badge, Options, Uniform } from '../src/data/schema';

const root = resolve(import.meta.dirname, '..');
const fix = process.argv.includes('--fix');

/** Problems found so far. Errors fail the run, warnings are only shown. */
const errors: string[] = [];
const warnings: string[] = [];

/** A uniform together with the name of the file it came from. */
interface UniformFile {
  file: string;
  data: Uniform;
}

/** Reads a JSON file under the project folder. */
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));

/** The unique key of a badge, like "medals/good-service". */
const keyOf = (b: Pick<Badge, 'category' | 'slug'>): string => `${b.category}/${b.slug}`;

/** True when a file exists under the project folder. */
const exists = (path: string): boolean => existsSync(join(root, path));

// ---------------------------------------------------------------------------------------------
// Load the files

const categories = z.array(CategorySchema).parse(readJson('src/data/categories.json'));
const badges = z.array(BadgeSchema).parse(readJson('src/data/badges.json'));
const options = OptionsSchema.parse(readJson('src/data/options.json'));
const uniforms = loadUniforms();

const categoryIds = new Set(categories.map((c) => c.id));
const serviceIds = new Set(options.services.map((x) => x.id));
const genderIds = new Set(options.genders.map((x) => x.id));
const dressIds = new Set(options.dresses.map((x) => x.id));
const badgeKeys = new Set(badges.map(keyOf));

/** Reads every uniform file in src/data/uniforms. */
function loadUniforms(): UniformFile[] {
  const dir = 'src/data/uniforms';
  return readdirSync(join(root, dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: f, data: UniformSchema.parse(readJson(`${dir}/${f}`)) }));
}

// ---------------------------------------------------------------------------------------------
// options.json

/** Every category named in options.json must exist. */
function checkOptions(): void {
  for (const c of [...options.rank.categories, ...options.rank.replacesBranch, options.branch.category]) {
    if (!categoryIds.has(c)) errors.push(`options.json: unknown category "${c}"`);
  }
}

// ---------------------------------------------------------------------------------------------
// badges.json

/** Checks the art files of one badge; with --fix, flips todo to redrawn when its art exists. Returns true if it changed. */
function checkBadgeArt(b: Badge, key: string): boolean {
  const hasArt = exists(`public/badges/${b.category}/${b.slug}.png`);
  if (b.status !== 'todo' && !hasArt) errors.push(`${key}: status is "${b.status}" but public/badges/${key}.png is missing`);
  if (b.status !== 'todo' || !hasArt) return false;

  if (!fix) {
    warnings.push(`${key}: art exists but status is "todo" (run npm run data:sync)`);
    return false;
  }
  b.status = 'redrawn';
  console.log(`  synced ${key}: todo -> redrawn`);
  return true;
}

/** Checks the per-service art variants of one badge. */
function checkArtVariants(b: Badge, key: string): void {
  for (const v of b.artVariants ?? []) {
    if (v.service !== undefined && !serviceIds.has(v.service)) errors.push(`${key}: art variant for unknown service "${v.service}"`);
    if (v.uniform !== undefined && !uniforms.some((u) => u.data.id === v.uniform)) errors.push(`${key}: art variant for unknown uniform "${v.uniform}"`);
    if (!exists(`public/${v.path}`)) errors.push(`${key}: art variant public/${v.path} is missing`);
  }
}

/** Checks the ribbon crop of one medal (it must be inside the 512 px art). */
function checkRibbonCrop(b: Badge, key: string): void {
  const r = b.ribbon;
  if (!r) return;
  if (b.category !== 'medals') errors.push(`${key}: only medals have a ribbon crop`);
  if (r.x < 0 || r.y < 0 || r.x + r.width > 512 || r.y + r.height > 512) errors.push(`${key}: ribbon crop is outside the 512 px art`);
}

/** Checks every badge. With --fix, saves the status changes back to badges.json. */
function checkBadges(): void {
  const seen = new Set<string>();
  let changed = false;
  for (const b of badges) {
    const key = keyOf(b);
    if (seen.has(key)) errors.push(`Duplicate badge ${key}`);
    seen.add(key);
    if (!categoryIds.has(b.category)) errors.push(`${key}: unknown category "${b.category}"`);

    if (checkBadgeArt(b, key)) changed = true;
    checkArtVariants(b, key);
    checkRibbonCrop(b, key);
    if (b.status === 'verified' && !b.sizeVerified) warnings.push(`${key}: verified but sizeVerified is false`);
  }
  if (changed) writeFileSync(join(root, 'src/data/badges.json'), JSON.stringify(badges, null, 2) + '\n');
}

// ---------------------------------------------------------------------------------------------
// uniforms/*.json

/** Which dress/service/gender combinations are drawn, and by which file. */
const drawings = new Map<string, string>();

/** Checks the top of a uniform file: its id, dress, services, genders, image and the combinations it draws. */
function checkUniformHeader({ file, data }: UniformFile): void {
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
  if (!exists(`public/${data.image}`)) errors.push(`${file}: image public/${data.image} is missing`);
}

/** Checks an anchor that draws ribbons: medals only, a horizontal row standing on y, and every medal has a crop. */
function checkRibbonAnchor(file: string, a: Uniform['anchors'][number]): void {
  if (a.render !== 'ribbon') {
    if (a.ribbon) warnings.push(`${file}: anchor ${a.id} has a ribbon size but does not draw ribbons`);
    return;
  }
  if (a.accepts.some((c) => c !== 'medals')) errors.push(`${file}: anchor ${a.id} draws ribbons, so it may only accept medals`);
  if (a.layout.direction !== 'horizontal' || a.layout.align !== 'bottom') {
    errors.push(`${file}: anchor ${a.id} draws ribbons: layout must be horizontal with align "bottom" (y is the bottom edge of the bar)`);
  }
  const missing = badges.filter((b) => b.category === 'medals' && !b.ribbon);
  if (missing.length) {
    warnings.push(`${file}: anchor ${a.id} draws ribbons but ${missing.length} medal(s) have no ribbon crop (the default band is used): ${missing.map((b) => b.slug).join(', ')}`);
  }
}

/** Checks the anchors (placement spots) of one uniform. */
function checkAnchors({ file, data }: UniformFile): void {
  const anchorIds = new Set<string>();
  for (const a of data.anchors) {
    if (anchorIds.has(a.id)) errors.push(`${file}: duplicate anchor ${a.id}`);
    anchorIds.add(a.id);
    for (const c of a.accepts) if (!categoryIds.has(c)) errors.push(`${file}: anchor ${a.id} accepts unknown category "${c}"`);
    for (const other of [a.stackAbove?.anchor, a.inLineWith]) {
      if (other && !data.anchors.some((x) => x.id === other)) errors.push(`${file}: anchor ${a.id} refers to unknown anchor "${other}"`);
    }
    checkRibbonAnchor(file, a);
    for (const key of Object.keys(a.itemScales ?? {})) {
      if (!badgeKeys.has(key)) errors.push(`${file}: anchor ${a.id} has an item scale for unknown badge ${key}`);
    }
    if (a.x < 0 || a.x > data.width || a.y < 0 || a.y > data.height) errors.push(`${file}: anchor ${a.id} is outside the image`);
    if (!a.verified) warnings.push(`${file}: anchor ${a.id} position not verified`);
  }
}

/** Warns about a category that says where it is worn but has no spot on this uniform. */
function checkCategoriesHaveSpots({ file, data }: UniformFile): void {
  for (const c of categories) {
    if (c.wornOn && !data.anchors.some((a) => a.accepts.includes(c.id))) {
      warnings.push(`${file}: no anchor for category "${c.id}" (worn: ${c.wornOn})`);
    }
  }
}

/** Checks every uniform file. */
function checkUniforms(): void {
  for (const u of uniforms) {
    checkUniformHeader(u);
    checkAnchors(u);
    checkCategoriesHaveSpots(u);
  }
}

// ---------------------------------------------------------------------------------------------
// mounted/*.json (perspective sprites from the badge-art-pipeline: npm run art:import)

/** Rank items must have sprites in a uniform's own mounted file. */
const NEEDS_SPRITES = ['shoulder-boards', 'rank-insignia', 'gorgets'];

/** Checks one mounted file: its uniform, service, dress, sprite files and (for a whole-uniform file) the rank items. */
function checkMountedFile(f: string): void {
  const m = MountedSchema.parse(readJson(`src/data/mounted/${f}`));
  if (!uniforms.some((u) => u.data.id === m.uniform)) errors.push(`mounted/${f}: unknown uniform "${m.uniform}"`);
  if (m.service !== undefined && !serviceIds.has(m.service)) errors.push(`mounted/${f}: unknown service "${m.service}"`);
  if (m.dress !== undefined && !dressIds.has(m.dress)) errors.push(`mounted/${f}: unknown dress "${m.dress}"`);

  for (const [key, slots] of Object.entries(m.items)) {
    if (!badgeKeys.has(key)) errors.push(`mounted/${f}: unknown badge ${key}`);
    for (const s of slots.flat()) {
      if (!exists(`public/${s.href}`)) errors.push(`mounted/${f}: ${key} sprite public/${s.href} is missing`);
    }
  }

  // A dress file holds only the items that differ; the uniform's own file has them all.
  if (m.dress !== undefined) return;
  for (const b of badges) {
    const key = keyOf(b);
    if (b.status !== 'todo' && NEEDS_SPRITES.includes(b.category) && !m.items[key]) {
      errors.push(`mounted/${f}: no perspective sprites for ${key} (re-export in badge-art-pipeline, then npm run art:import)`);
    }
  }
}

/** Checks every mounted file. */
function checkMounted(): void {
  const dir = join(root, 'src/data/mounted');
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) checkMountedFile(f);
}

// ---------------------------------------------------------------------------------------------
// Summary

/** Prints how many badges and uniforms there are, and warns about dress/service/gender combinations with no drawing. */
function printSummary(): void {
  const byStatus = new Map<string, number>();
  for (const b of badges) byStatus.set(b.status, (byStatus.get(b.status) ?? 0) + 1);
  console.log(`Badges: ${badges.length} (${[...byStatus].map(([s, n]) => `${n} ${s}`).join(', ')})`);
  console.log(`Uniforms: ${uniforms.length} (${uniforms.map((u) => u.data.id).join(', ')})`);

  const undrawn = notDrawn(options);
  if (undrawn.length) warnings.push(`not drawn yet (shown as "Not drawn yet" on the selection screen): ${undrawn.join(', ')}`);
}

/** The names of the dress/service/gender combinations that no uniform file draws. */
function notDrawn(o: Options): string[] {
  return o.dresses.flatMap((d) =>
    o.services.flatMap((sv) =>
      o.genders.filter((g) => !drawings.has(`${d.id} / ${sv.id} / ${g.id}`)).map((g) => `${d.name} ${sv.name} ${g.name}`),
    ),
  );
}

/** Prints the warnings and errors; exits with code 1 when there are errors. */
function finish(): void {
  if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n  ` + warnings.join('\n  '));
  if (errors.length) {
    console.error(`\nErrors (${errors.length}):\n  ` + errors.join('\n  '));
    process.exit(1);
  }
  console.log('\nData OK.');
}

checkOptions();
checkBadges();
checkUniforms();
checkMounted();
printSummary();
finish();
