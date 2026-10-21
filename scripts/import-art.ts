// Imports a bundle made by the badge-art-pipeline project (sibling repo) into this app.
//
//   npm run art:import -- ../badge-art-pipeline/export/number-1
//   npm run art:import -- <bundle folder> --dry     (check and report, change nothing)
//
// A bundle is a folder with bundle.json, badges/<category>/<slug>.png and mounted/<uniform>/*.png.
// For every category listed in bundle.json, the app's art and library entries for that category are
// replaced by the bundle's; every other category and badge is left alone. The perspective sprites for the
// bundle's uniform are replaced too, and src/data/mounted/<uniform>.json is rewritten.
// Run `npm run data:validate` afterwards (this script runs the same checks on the bundle first).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { BadgeSchema, CategorySchema, MountedSchema } from '../src/data/schema';

const root = resolve(import.meta.dirname, '..');

/** What bundle.json must contain. */
const BundleSchema = z.object({
  format: z.literal(1),
  uniform: z.string().min(1),
  categories: z.array(z.string().min(1)).min(1),
  badges: z.array(BadgeSchema),
  mounted: MountedSchema,
  /** Sleeve rank in each service's and dress's colours: one file per dress and service (see rank_variants.py). */
  rankVariants: z.array(MountedSchema).optional(),
});
type Bundle = z.infer<typeof BundleSchema>;

/** A badge entry as it is stored in badges.json (only the fields this script touches). */
interface StoredBadge {
  category: string;
  slug: string;
  widthMm: number;
  heightMm?: number;
  ribbon?: unknown;
}

/** Reads and parses a JSON file. */
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

/** Writes a JSON file, indented, with a newline at the end. */
const writeJson = (path: string, data: unknown): void => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');

/** Stops the script with a message. */
function stop(message: string): never {
  console.error(message);
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------
// Checking the bundle

/** Finds the bundle folder from the command line and returns it with its parsed bundle.json. */
function openBundle(): { bundleDir: string; bundle: Bundle; rawBadges: Record<string, unknown>[] } {
  const dirArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!dirArg) {
    stop('Usage: npm run art:import -- <bundle folder> [--dry]\n  e.g. npm run art:import -- ../badge-art-pipeline/export/number-1');
  }
  const bundleDir = resolve(process.cwd(), dirArg);
  const bundleFile = join(bundleDir, 'bundle.json');
  if (!existsSync(bundleFile)) {
    stop(`No bundle.json in ${bundleDir}. Make one with: python badgeart.py export (in badge-art-pipeline).`);
  }
  const raw = readJson(bundleFile) as { badges: Record<string, unknown>[] };
  // The raw badges are written back untouched, which keeps their key order.
  return { bundleDir, bundle: BundleSchema.parse(raw), rawBadges: raw.badges };
}

/** Problems with the categories and the uniform named by the bundle. */
function checkBundleHeader(bundle: Bundle, errors: string[]): void {
  const categories = z.array(CategorySchema).parse(readJson(join(root, 'src/data/categories.json')));
  const known = new Set(categories.map((c) => c.id));
  for (const c of bundle.categories) if (!known.has(c)) errors.push(`bundle category "${c}" is not in src/data/categories.json`);
  if (bundle.mounted.uniform !== bundle.uniform) errors.push(`mounted.uniform "${bundle.mounted.uniform}" differs from uniform "${bundle.uniform}"`);
  if (!existsSync(join(root, 'src/data/uniforms', `${bundle.uniform}.json`))) errors.push(`no src/data/uniforms/${bundle.uniform}.json in this app`);
}

/** Problems with the bundle's badges (listed category, art file present). Returns the badge keys. */
function checkBundleBadges(bundle: Bundle, bundleDir: string, errors: string[]): Set<string> {
  const keys = new Set<string>();
  for (const b of bundle.badges) {
    const key = `${b.category}/${b.slug}`;
    keys.add(key);
    if (!bundle.categories.includes(b.category)) errors.push(`${key}: category is not listed in bundle.categories`);
    if (!existsSync(join(bundleDir, 'badges', b.category, `${b.slug}.png`))) errors.push(`${key}: badges/${key}.png is missing from the bundle`);
  }
  return keys;
}

/** Problems with the bundle's perspective sprites: each file is present and inside mounted/<uniform>/. */
function checkBundleSprites(bundle: Bundle, bundleDir: string, errors: string[]): void {
  for (const [key, slots] of Object.entries(bundle.mounted.items)) {
    for (const s of slots.flat()) {
      if (!existsSync(join(bundleDir, s.href))) errors.push(`${key}: sprite ${s.href} is missing from the bundle`);
      if (!s.href.startsWith(`mounted/${bundle.uniform}/`)) errors.push(`${key}: sprite ${s.href} is outside mounted/${bundle.uniform}/`);
    }
  }
}

/** Problems with the coloured sleeve ranks (rankVariants). */
function checkRankVariants(bundle: Bundle, bundleDir: string, keys: Set<string>, errors: string[]): void {
  for (const v of bundle.rankVariants ?? []) {
    const label = `rank variant ${v.dress ?? '?'}/${v.service ?? '?'}`;
    if (v.uniform !== bundle.uniform) errors.push(`${label}: uniform "${v.uniform}" differs from "${bundle.uniform}"`);
    if (!v.dress || !v.service) errors.push(`${label}: needs a dress and a service`);
    for (const [key, slots] of Object.entries(v.items)) {
      if (!keys.has(key)) errors.push(`${label}: ${key} is not a badge in the bundle`);
      for (const s of slots.flat()) {
        if (!existsSync(join(bundleDir, s.href))) errors.push(`${label}: sprite ${s.href} is missing from the bundle`);
        if (!s.href.startsWith(`mounted/${bundle.uniform}-ranks/`)) errors.push(`${label}: sprite ${s.href} is outside mounted/${bundle.uniform}-ranks/`);
      }
    }
  }
}

/** Runs every bundle check; stops the script if any fails. */
function checkBundle(bundle: Bundle, bundleDir: string): void {
  const errors: string[] = [];
  checkBundleHeader(bundle, errors);
  const keys = checkBundleBadges(bundle, bundleDir, errors);
  checkBundleSprites(bundle, bundleDir, errors);
  checkRankVariants(bundle, bundleDir, keys, errors);
  if (errors.length) stop(`Bundle problems (${errors.length}):\n  ` + errors.join('\n  '));
}

// ---------------------------------------------------------------------------------------------
// Importing

/** Replaces the flat art of the bundle's categories in public/badges. */
function copyBadgeArt(bundle: Bundle, bundleDir: string): void {
  for (const c of bundle.categories) rmSync(join(root, 'public/badges', c), { recursive: true, force: true });
  for (const c of bundle.categories) {
    const from = join(bundleDir, 'badges', c);
    if (existsSync(from)) cpSync(from, join(root, 'public/badges', c), { recursive: true });
  }
}

/** Replaces the uniform's perspective sprites in public/mounted/<uniform>. */
function copySprites(bundle: Bundle, bundleDir: string): void {
  const to = join(root, 'public/mounted', bundle.uniform);
  rmSync(to, { recursive: true, force: true });
  mkdirSync(join(root, 'public/mounted'), { recursive: true });
  cpSync(join(bundleDir, 'mounted', bundle.uniform), to, { recursive: true });
}

/**
 * Sleeve ranks in each service's and dress's colours. Their sprites live in public/mounted/<uniform>-ranks and
 * their data in src/data/mounted/<uniform>.ranks-<dress>-<service>.json. The old ones go first so a re-import
 * leaves nothing stale. A bundle without rankVariants leaves them as they are.
 */
function importRankVariants(bundle: Bundle, bundleDir: string): void {
  const variants = bundle.rankVariants ?? [];
  if (variants.length === 0) return;

  const sprites = join(root, 'public/mounted', `${bundle.uniform}-ranks`);
  rmSync(sprites, { recursive: true, force: true });
  cpSync(join(bundleDir, 'mounted', `${bundle.uniform}-ranks`), sprites, { recursive: true });

  const dataDir = join(root, 'src/data/mounted');
  for (const f of readdirSync(dataDir)) if (f.startsWith(`${bundle.uniform}.ranks-`)) rmSync(join(dataDir, f));
  for (const v of variants) {
    writeJson(join(dataDir, `${bundle.uniform}.ranks-${v.dress}-${v.service}.json`), {
      $comment:
        'Generated by npm run art:import (bundle.json "rankVariants"). Do not edit. The sleeve rank in the colours ' +
        'this service wears with this dress; it replaces the same items of the uniform file (resolveMounted).',
      uniform: v.uniform,
      service: v.service,
      dress: v.dress,
      items: v.items,
    });
  }
}

/**
 * The bundle's badge entries, except that a tall item (a medal) keeps the box and ribbon crop it already has here.
 * The pipeline does not know them, so a re-import must not lose them.
 */
function keepOwnBoxes(rawBadges: Record<string, unknown>[], existing: StoredBadge[]): Record<string, unknown>[] {
  const tall = new Map(existing.filter((b) => b.heightMm !== undefined).map((b) => [`${b.category}/${b.slug}`, b]));
  return rawBadges.map((b) => {
    const own = tall.get(`${b.category}/${b.slug}`);
    if (!own) return b;
    return { ...b, widthMm: own.widthMm, heightMm: own.heightMm, ...(own.ribbon ? { ribbon: own.ribbon } : {}) };
  });
}

/** Writes the sprite data file of the uniform, src/data/mounted/<uniform>.json. */
function writeMountedData(bundle: Bundle): void {
  writeJson(join(root, 'src/data/mounted', `${bundle.uniform}.json`), {
    $comment:
      'Generated by npm run art:import from the badge-art-pipeline bundle. Do not edit: re-export and re-import ' +
      'after changing art or mounts. Each item has one list of sprites per slot (slot = its position among the ' +
      'items sharing its spot).',
    uniform: bundle.uniform,
    items: bundle.mounted.items,
  });
}

// ---------------------------------------------------------------------------------------------
// Run

const dry = process.argv.includes('--dry');
const { bundleDir, bundle, rawBadges } = openBundle();
checkBundle(bundle, bundleDir);

const badgesPath = join(root, 'src/data/badges.json');
const existing = readJson(badgesPath) as StoredBadge[];
const kept = existing.filter((b) => !bundle.categories.includes(b.category));
const rankSets = bundle.rankVariants?.length ?? 0;
console.log(
  `Bundle: uniform ${bundle.uniform}, ${bundle.badges.length} badges in ${bundle.categories.join(', ')}, ` +
    `${Object.keys(bundle.mounted.items).length} items with perspective sprites` +
    (rankSets ? ` and ${rankSets} dress/service sets of coloured sleeve ranks.` : '.'),
);
console.log(`Library: ${existing.length - kept.length} existing entries in those categories are replaced, ${kept.length} others stay.`);
if (dry) {
  console.log('Dry run: nothing changed.');
  process.exit(0);
}

copyBadgeArt(bundle, bundleDir);
copySprites(bundle, bundleDir);
importRankVariants(bundle, bundleDir);
writeJson(badgesPath, [...kept, ...keepOwnBoxes(rawBadges, existing)]);
writeMountedData(bundle);
console.log(`Imported. Files now in public/badges: ${bundle.categories.map((c) => `${c} ${readdirSync(join(root, 'public/badges', c)).length}`).join(', ')}.`);
console.log('Next: npm run data:validate');
