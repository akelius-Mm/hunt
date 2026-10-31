/**
 * World units. Gameplay (positions, speeds, hit zones) works in a 640x360 world: a wide
 * frame where the hunter stands small in a big landscape. The screen renders that
 * world at PX times the resolution, so art can have finer detail while every pixel
 * stays the same size.
 */
export const VIEW_W = 640;
export const VIEW_H = 360;
/** Screen pixels per world unit. */
export const PX = 2;
export const SCREEN_W = VIEW_W * PX;
export const SCREEN_H = VIEW_H * PX;
/** Where feet touch the ground, in world units. Low in the frame, so the sky and trees get room. */
export const GROUND_Y = 296;
/** In lake areas, where the far shore meets the water. */
export const LAKE_HORIZON = GROUND_Y - 58;
/** Where ducks float on the lake (bottom of the sprite). */
export const WATER_Y = GROUND_Y - 16;
