import { z } from 'zod';
import categoriesJson from './categories.json';
import badgesJson from './badges.json';
import number1 from './uniforms/number-1.json';
import { BadgeSchema, CategorySchema, UniformSchema } from './schema';

// Parse at load time so a typo in any JSON file fails loudly in the browser console and in tests.
export const categories = z.array(CategorySchema).parse(categoriesJson);
export const badges = z.array(BadgeSchema).parse(badgesJson);

// To add a uniform: create src/data/uniforms/<id>.json, import it here and add it to this list.
export const uniforms = [number1].map((u) => UniformSchema.parse(u));

export const categoryById = new Map(categories.map((c) => [c.id, c]));

export type { Badge, Category, Uniform, Anchor } from './schema';
