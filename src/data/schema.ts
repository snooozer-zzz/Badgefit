// The shape of every JSON data file (zod schemas), and the TypeScript types made from them.
// Add a field here first; data/index.ts and npm run data:validate then check the files against it.
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
  /**
   * true = the user can pick these in the badge library. false = they are chosen some other way: arms,
   * shoulder boards, rank insignia and gorgets come from the selection screen (branch and rank), and
   * formation badges have no placement spot.
   */
  selectable: z.boolean(),
  source: z.string(),
});

/**
 * todo     = no redrawn art yet (library shows a placeholder tile)
 * redrawn  = art exists in public/badges/<category>/<slug>.png
 * verified = art AND size/placement checked against the dress regulations
 */
const BadgeStatusSchema = z.enum(['todo', 'redrawn', 'verified']);

/** Art for one service, one dress and/or one uniform. With none of them it would be the shared art, so one is required. */
const ArtVariantSchema = z
  .object({
    service: z.string().min(1).optional(),
    /** A dress id from options.json (e.g. "number-2"): every uniform of that dress. */
    dress: z.string().min(1).optional(),
    uniform: z.string().min(1).optional(),
    /** Path under public/. */
    path: z.string().min(1),
  })
  .refine((v) => v.service !== undefined || v.dress !== undefined || v.uniform !== undefined, 'an art variant needs a service, a dress or a uniform');

export const BadgeSchema = z.object({
  /** Unique within its category. Also the art file name. */
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  category: z.string().min(1),
  status: BadgeStatusSchema,
  /** Real-world width in millimetres. Placeholder until sizeVerified is true. */
  widthMm: z.number().positive(),
  /**
   * Height of the box the art is drawn in. Leave out for a square box (most badges). Tall art such as
   * medals is a square PNG with empty sides: a narrow, tall box shows only the middle strip of it.
   */
  heightMm: z.number().positive().optional(),
  /**
   * Medals only: the part of the art that is the ribbon, in pixels of the 512 px square PNG. An anchor with
   * render "ribbon" draws just this rectangle (a ribbon bar). Leave out to use the default band (see lib/ribbon.ts).
   */
  ribbon: z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() }).optional(),
  sizeVerified: z.boolean(),
  /** Official photo used as the reference when redrawing. Never shipped in the app. */
  referenceUrl: z.string().optional(),
  notes: z.string().optional(),
  /** Rank code for rank items (shoulder boards, rank insignia, gorgets), e.g. "2LT". */
  rank: z.string().optional(),
  /** Ranks that wear this item when it carries no rank of its own (the plain shoulder board). */
  usedBy: z.array(z.string()).optional(),
  /** Only one badge of the same group is worn at a time (e.g. "marksmanship"). */
  exclusiveGroup: z.string().optional(),
  /** Lower numbers go first on a spot, after the category order. Default 0. Marksmanship is 1: it goes below IPPT. */
  layoutOrder: z.number().optional(),
  /**
   * Art made for one service and/or one uniform (e.g. an RSAF shoulder board). Leave out while every
   * service wears the shared art at public/badges/<category>/<slug>.png. See resolveBadgeArt in lib/art.ts.
   */
  artVariants: z.array(ArtVariantSchema).optional(),
});

const AnchorSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Centre of the spot, in uniform image pixels. */
  x: z.number(),
  y: z.number(),
  /** Category ids that may be placed here. */
  accepts: z.array(z.string()).min(1),
  /** Most badges worn here in total, across all the accepted categories. Leave out if no limit is stated. */
  maxItems: z.number().int().positive().optional(),
  /** How several badges sharing this spot are arranged. */
  layout: z.object({
    direction: z.enum(['horizontal', 'vertical']),
    gapPx: z.number().min(0),
    /**
     * Horizontal rows only: which edge of the badges the anchor's y is. 'top' = the badges hang from y
     * (medals), 'bottom' = they stand on y (SAF badges). Leave out to centre them on y.
     */
    align: z.enum(['top', 'center', 'bottom']).optional(),
    /**
     * Horizontal rows only, with align 'bottom': from 3 badges up, the first stands alone on top and the rest
     * form the row below it (a pyramid). Fewer than 3 stay in one row.
     */
    pyramid: z.boolean().optional(),
    /** Pyramid only: gap between its two rows in pixels. Negative lets the boxes overlap (the art has transparent padding). Default gapPx. */
    rowGapPx: z.number().optional(),
    /** Horizontal rows only: a row wider than this overlaps its badges until it fits. Leave out for no limit. */
    maxWidthMm: z.number().positive().optional(),
  }),
  /** When badges are worn at the spot `anchor`, sit `mmGap` above the top of them instead of at y. */
  stackAbove: z.object({ anchor: z.string().min(1), mmGap: z.number().min(0) }).optional(),
  /** Id of a spot to line up with: if badges are worn there and higher, this row moves up to the same bottom edge. */
  inLineWith: z.string().min(1).optional(),
  /** Degrees clockwise, about the middle of each badge's box. For flat badges on a slanted part (collar). */
  rotation: z.number().optional(),
  /**
   * The badges here are worn on a second spot too (both collars): drawn again with the same layout moved to
   * this centre and turned by this rotation. Clicking either copy removes the badge.
   */
  copy: z.object({ x: z.number(), y: z.number(), rotation: z.number().optional() }).optional(),
  /**
   * Highest y (smallest) the badges here may reach. Does not change the layout: a test checks that the badges stay
   * below it (3 SAF badges over medals must stay below the shoulder board). Set it from the uniform art.
   */
  minY: z.number().optional(),
  /**
   * Multiplies the size (width and height) of every badge at this spot, and so the rows and gaps built from them.
   * Leave out for 1. For flat art standing in for a mounted sprite, or miniatures (medals on a mess dress lapel).
   */
  scale: z.number().positive().optional(),
  /** Extra scale for single badges, by badge key ("proficiency/marksmanship"), on top of `scale`. Leave out for 1. */
  itemScales: z.record(z.string(), z.number().positive()).optional(),
  /**
   * 'ribbon' (medals only): draw just the ribbon of each medal, cut out of its art, in a small box (`ribbon`), side
   * by side with no gap, `perRow` to a row and extra rows stacked upward. The anchor's y is the bottom edge of the
   * first row. Leave out (or 'art') to draw the whole art of each badge.
   */
  render: z.enum(['art', 'ribbon']).optional(),
  /** Ribbon mode: the box of one ribbon in millimetres and how many sit in a row (default 3). */
  ribbon: z
    .object({ widthMm: z.number().positive(), heightMm: z.number().positive(), perRow: z.number().int().positive().optional() })
    .optional(),
  /** true = draw the flat art here even if the uniform has perspective sprites for the badge (a pin on a lapel, not the sleeve). */
  flat: z.boolean().optional(),
  /** false until the position has been checked against the dress regulations. */
  verified: z.boolean(),
  note: z.string().optional(),
});

export const UniformSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Which dress this is (an id in options.json), e.g. "number-2". */
  dress: z.string().min(1),
  /** Services that wear it (ids in options.json). One drawing can serve several, as No. 1 does. */
  services: z.array(z.string().min(1)).min(1),
  /** Genders the drawing is for (ids in options.json). */
  genders: z.array(z.string().min(1)).min(1),
  /** Path under public/. */
  image: z.string().min(1),
  /**
   * Id of the uniform whose perspective sprites (shoulders, sleeves) this one uses, when it has the same
   * shoulders and sleeves in the same place. Leave out to use the sprites made for this uniform's own id.
   */
  mountedFrom: z.string().min(1).optional(),
  width: z.number().positive(),
  height: z.number().positive(),
  /** Image pixels per real-world millimetre. Approximate until verified. */
  pxPerMm: z.number().positive(),
  anchors: z.array(AnchorSchema),
});

/** One pre-rendered piece of an item as seen on the uniform (perspective already applied). */
const MountedSpriteSchema = z.object({
  /** Path under public/. */
  href: z.string().min(1),
  /** Top-left corner and size, in uniform image pixels. */
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

/**
 * Items worn on curved or sloped parts of a uniform (shoulders, sleeves, collar), pre-rendered in
 * perspective by the badge-art-pipeline project and brought in by npm run art:import. items[badgeKey][slot] = the sprites to draw when the item is
 * the slot-th one on its spot (e.g. the second proficiency badge sits lower on the sleeve).
 */
export const MountedSchema = z.object({
  uniform: z.string().min(1),
  /** Leave out for sprites every service shares. A file with a service is used for that service only. */
  service: z.string().min(1).optional(),
  /**
   * A dress id (options.json). A file with a dress holds only the items that look different on that dress for
   * that service (today: the sleeve rank in the colours of each service and dress). Its items replace the
   * same items of the uniform's own file, which supplies the rest. See resolveMounted in lib/art.ts.
   */
  dress: z.string().min(1).optional(),
  items: z.record(z.string(), z.array(z.array(MountedSpriteSchema).min(1))),
});

/** The choices on the selection screen. */
export const OptionsSchema = z.object({
  services: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })).min(1),
  genders: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })).min(1),
  dresses: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })).min(1),
  /**
   * Rank is the rank insignia and the shoulder board together. `categories` are the categories whose items
   * carry a rank (the dropdown lists ranks in this category order, then file order). Items of a category in
   * `replacesBranch` (gorgets) are worn in place of the branch (arms) badge.
   */
  rank: z.object({ categories: z.array(z.string().min(1)).min(1), replacesBranch: z.array(z.string().min(1)) }),
  /** Branch is the collar badge: the items of this category. */
  branch: z.object({ category: z.string().min(1) }),
});

export type Category = z.infer<typeof CategorySchema>;
export type Badge = z.infer<typeof BadgeSchema>;
export type Anchor = z.infer<typeof AnchorSchema>;
export type Uniform = z.infer<typeof UniformSchema>;
export type Mounted = z.infer<typeof MountedSchema>;
export type Options = z.infer<typeof OptionsSchema>;
