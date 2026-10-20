/**
 * Imports a bundle made by the badge-art-pipeline project (sibling repo) into this app.
 *
 *   npm run art:import -- ../badge-art-pipeline/export/number-1
 *   npm run art:import -- <bundle folder> --dry     (check and report, change nothing)
 *
 * A bundle is a folder with bundle.json, badges/<category>/<slug>.png and mounted/<uniform>/*.png.
 * For every category listed in bundle.json, the app's art and library entries for that category are
 * replaced by the bundle's; every other category and badge is left alone. The perspective sprites for the
 * bundle's uniform are replaced too, and src/data/mounted/<uniform>.json is rewritten.
 * Run `npm run data:validate` afterwards (this script runs the same checks on the bundle first).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { BadgeSchema, CategorySchema, MountedSchema } from '../src/data/schema';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const dirArg = args.find((a) => !a.startsWith('--'));
if (!dirArg) {
  console.error('Usage: npm run art:import -- <bundle folder> [--dry]\n  e.g. npm run art:import -- ../badge-art-pipeline/export/number-1');
  process.exit(1);
}
const bundleDir = resolve(process.cwd(), dirArg);
const bundleFile = join(bundleDir, 'bundle.json');
if (!existsSync(bundleFile)) {
  console.error(`No bundle.json in ${bundleDir}. Make one with: python badgeart.py export (in badge-art-pipeline).`);
  process.exit(1);
}

const BundleSchema = z.object({
  format: z.literal(1),
  uniform: z.string().min(1),
  categories: z.array(z.string().min(1)).min(1),
  badges: z.array(BadgeSchema),
  mounted: MountedSchema,
});
const raw = JSON.parse(readFileSync(bundleFile, 'utf8')) as { badges: unknown[] };
const bundle = BundleSchema.parse(raw);
const rawBadges = raw.badges as Record<string, unknown>[]; // written back untouched (keeps key order)

const errors: string[] = [];
const categories = z.array(CategorySchema).parse(JSON.parse(readFileSync(join(root, 'src/data/categories.json'), 'utf8')));
const known = new Set(categories.map((c) => c.id));
for (const c of bundle.categories) if (!known.has(c)) errors.push(`bundle category "${c}" is not in src/data/categories.json`);
if (bundle.mounted.uniform !== bundle.uniform) errors.push(`mounted.uniform "${bundle.mounted.uniform}" differs from uniform "${bundle.uniform}"`);
if (!existsSync(join(root, 'src/data/uniforms', `${bundle.uniform}.json`))) errors.push(`no src/data/uniforms/${bundle.uniform}.json in this app`);

const keys = new Set<string>();
for (const b of bundle.badges) {
  const key = `${b.category}/${b.slug}`;
  keys.add(key);
  if (!bundle.categories.includes(b.category)) errors.push(`${key}: category is not listed in bundle.categories`);
  if (!existsSync(join(bundleDir, 'badges', b.category, `${b.slug}.png`))) errors.push(`${key}: badges/${key}.png is missing from the bundle`);
}
for (const [key, slots] of Object.entries(bundle.mounted.items)) {
  for (const s of slots.flat()) {
    if (!existsSync(join(bundleDir, s.href))) errors.push(`${key}: sprite ${s.href} is missing from the bundle`);
    if (!s.href.startsWith(`mounted/${bundle.uniform}/`)) errors.push(`${key}: sprite ${s.href} is outside mounted/${bundle.uniform}/`);
  }
}
if (errors.length) {
  console.error(`Bundle problems (${errors.length}):\n  ` + errors.join('\n  '));
  process.exit(1);
}

const badgesPath = join(root, 'src/data/badges.json');
const existing = JSON.parse(readFileSync(badgesPath, 'utf8')) as { category: string }[];
const kept = existing.filter((b) => !bundle.categories.includes(b.category));
const replaced = existing.length - kept.length;
console.log(
  `Bundle: uniform ${bundle.uniform}, ${bundle.badges.length} badges in ${bundle.categories.join(', ')}, ` +
    `${Object.keys(bundle.mounted.items).length} items with perspective sprites.`,
);
console.log(`Library: ${replaced} existing entries in those categories are replaced, ${kept.length} others stay.`);
if (dry) {
  console.log('Dry run: nothing changed.');
  process.exit(0);
}

for (const c of bundle.categories) rmSync(join(root, 'public/badges', c), { recursive: true, force: true });
for (const c of bundle.categories) {
  const from = join(bundleDir, 'badges', c);
  if (existsSync(from)) cpSync(from, join(root, 'public/badges', c), { recursive: true });
}
const spritesTo = join(root, 'public/mounted', bundle.uniform);
rmSync(spritesTo, { recursive: true, force: true });
mkdirSync(join(root, 'public/mounted'), { recursive: true });
cpSync(join(bundleDir, 'mounted', bundle.uniform), spritesTo, { recursive: true });

// The pipeline does not know the box a tall item (medals) is drawn in, so a re-import must not lose it:
// widthMm and heightMm of an existing entry that has a heightMm win over the bundle's.
const boxKept = new Map(
  (existing as { category: string; slug: string; widthMm: number; heightMm?: number }[])
    .filter((b) => b.heightMm !== undefined)
    .map((b) => [`${b.category}/${b.slug}`, b]),
);
const imported = rawBadges.map((b) => {
  const own = boxKept.get(`${b.category}/${b.slug}`);
  return own ? { ...b, widthMm: own.widthMm, heightMm: own.heightMm } : b;
});
writeFileSync(badgesPath, JSON.stringify([...kept, ...imported], null, 2) + '\n');
writeFileSync(
  join(root, 'src/data/mounted', `${bundle.uniform}.json`),
  JSON.stringify(
    {
      $comment:
        'Generated by npm run art:import from the badge-art-pipeline bundle. Do not edit: re-export and re-import ' +
        'after changing art or mounts. Each item has one list of sprites per slot (slot = its position among the ' +
        'items sharing its spot).',
      uniform: bundle.uniform,
      items: bundle.mounted.items,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Imported. Files now in public/badges: ${bundle.categories.map((c) => `${c} ${readdirSync(join(root, 'public/badges', c)).length}`).join(', ')}.`);
console.log('Next: npm run data:validate');
