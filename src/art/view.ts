/**
 * World units. Gameplay (positions, speeds, hit zones) works in a 480x270 world. The
 * screen renders that world at PX times the resolution, so art can have finer detail
 * while every pixel stays the same size.
 */
export const VIEW_W = 480;
export const VIEW_H = 270;
/** Screen pixels per world unit. */
export const PX = 2;
export const SCREEN_W = VIEW_W * PX;
export const SCREEN_H = VIEW_H * PX;
/** Where feet touch the ground, in world units. */
export const GROUND_Y = 222;
/** In lake areas, where the far shore meets the water. */
export const LAKE_HORIZON = 164;
/** Where ducks float on the lake (bottom of the sprite). */
export const WATER_Y = 206;
