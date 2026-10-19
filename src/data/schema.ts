import { z } from 'zod';

/** Where a group of badges is worn, plus the rules the source page states for it. */
export const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Display order, also the order badges are laid out when they share a spot. */
  order: z.number().int(),
  /** Plain-text wording of where it is worn. null = the source does not say. */
  wornOn: z.string().nullable(),
  description: z.string(),
  /** Maximum worn at one time. null = no limit stated. */
  maxWorn: z.number().int().positive().nullable(),
  source: z.string(),
});

/**
 * todo     = no redrawn art yet (library shows a placeholder tile)
 * redrawn  = art exists in public/badges/<category>/<slug>.png
 * verified = art AND size/placement checked against the dress regulations
 */
export const BadgeStatusSchema = z.enum(['todo', 'redrawn', 'verified']);

export const BadgeSchema = z.object({
  /** Unique within its category. Also the art file name. */
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  category: z.string().min(1),
  status: BadgeStatusSchema,
  /** Real-world width in millimetres. Placeholder until sizeVerified is true. */
  widthMm: z.number().positive(),
  sizeVerified: z.boolean(),
  /** Official photo used as the reference when redrawing. Never shipped in the app. */
  referenceUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const AnchorSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Centre of the spot, in uniform image pixels. */
  x: z.number(),
  y: z.number(),
  /** Category ids that may be placed here. */
  accepts: z.array(z.string()).min(1),
  /** How several badges sharing this spot are arranged. */
  layout: z.object({
    direction: z.enum(['horizontal', 'vertical']),
    gapPx: z.number().min(0),
  }),
  /** false until the position has been checked against the dress regulations. */
  verified: z.boolean(),
  note: z.string().optional(),
});

export const UniformSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Path under public/. */
  image: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  /** Image pixels per real-world millimetre. Approximate until verified. */
  pxPerMm: z.number().positive(),
  anchors: z.array(AnchorSchema),
});

export type Category = z.infer<typeof CategorySchema>;
export type Badge = z.infer<typeof BadgeSchema>;
export type BadgeStatus = z.infer<typeof BadgeStatusSchema>;
export type Anchor = z.infer<typeof AnchorSchema>;
export type Uniform = z.infer<typeof UniformSchema>;
