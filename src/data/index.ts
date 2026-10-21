// Loads every JSON data file and checks it against the schemas in schema.ts.
// A typo in any data file stops the app (and the tests) with a clear message instead of failing quietly.
import { z } from 'zod';
import categoriesJson from './categories.json';
import badgesJson from './badges.json';
import optionsJson from './options.json';
import { BadgeSchema, CategorySchema, MountedSchema, OptionsSchema, UniformSchema } from './schema';

export const categories = z.array(CategorySchema).parse(categoriesJson);
export const badges = z.array(BadgeSchema).parse(badgesJson);
export const options = OptionsSchema.parse(optionsJson);

// Every file in uniforms/ is a uniform and every file in mounted/ is a set of perspective sprites,
// so there is nothing to register. See docs/ADDING_BADGES.md ("A new uniform").
const uniformFiles = import.meta.glob('./uniforms/*.json', { eager: true, import: 'default' });
const mountedFiles = import.meta.glob('./mounted/*.json', { eager: true, import: 'default' });

export const uniforms = Object.keys(uniformFiles)
  .sort()
  .map((file) => UniformSchema.parse(uniformFiles[file]));

// Perspective sprites, brought in from the badge-art-pipeline by `npm run art:import`. Several files can
// exist for one uniform (one per service); resolveMounted in lib/art.ts picks the one to use.
export const mountedList = Object.keys(mountedFiles)
  .sort()
  .map((file) => MountedSchema.parse(mountedFiles[file]));
