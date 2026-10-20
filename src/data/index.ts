import { z } from 'zod';
import categoriesJson from './categories.json';
import badgesJson from './badges.json';
import optionsJson from './options.json';
import { BadgeSchema, CategorySchema, MountedSchema, OptionsSchema, UniformSchema } from './schema';

// Parse at load time so a typo in any JSON file fails loudly in the browser console and in tests.
export const categories = z.array(CategorySchema).parse(categoriesJson);
export const badges = z.array(BadgeSchema).parse(badgesJson);
export const options = OptionsSchema.parse(optionsJson);

// Every file in src/data/uniforms/ is a uniform and every file in src/data/mounted/ is a set of perspective
// sprites: there is nothing to register. See docs/ADDING_BADGES.md ("A new uniform").
const uniformFiles = import.meta.glob('./uniforms/*.json', { eager: true, import: 'default' });
const mountedFiles = import.meta.glob('./mounted/*.json', { eager: true, import: 'default' });

export const uniforms = Object.keys(uniformFiles)
  .sort()
  .map((file) => UniformSchema.parse(uniformFiles[file]));

export const categoryById = new Map(categories.map((c) => [c.id, c]));

// Perspective sprites (imported from the badge-art-pipeline bundle by npm run art:import). Several files may
// exist for one uniform when a service has its own; resolveMounted (lib/art.ts) picks the one to use.
export const mountedList = Object.keys(mountedFiles)
  .sort()
  .map((file) => MountedSchema.parse(mountedFiles[file]));

export type { Badge, Category, Uniform, Anchor, Mounted, MountedSprite, Options } from './schema';
