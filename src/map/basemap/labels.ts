/**
 * How much of the basemap's own type the map shows.
 *
 * A vector basemap is drawn to be read on its own, so it names everything it can:
 * house numbers, building names, entrances, every shop and clinic. Under this
 * product that type is not the content -- the marks are -- and it competes with
 * them twice over, for attention and for the same few pixels of a 12px disc.
 *
 * The sheet already switches some classes off; these rules switch off more, and
 * are appended AFTER the sheet's own so they win. Nothing here recolours anything:
 * the tone of the type that survives is the palette's business (`palette.ts`).
 */

import type { CustomizationEntry } from "./roles";

export type LabelDensity =
    /** Everything the sheet itself decided to show. The control arm. */
    | "full"
    /** No house numbers, building names, entrances or amenity labels. */
    | "reduced"
    /** Places and water only: no road names, no parks, no landscape. */
    | "minimal";

const off = (tags: string[]): CustomizationEntry => ({
    tags: { any: tags },
    elements: "label",
    stylers: { visibility: "off" },
});

/**
 * House numbers are the single biggest volume of type on a city map at the zoom
 * this product is used at, and a mark IS an address -- the panel says which one.
 * Building and entrance names go with them; amenity labels are somebody else's
 * data, drawn in the same grey as the street names that actually orient you.
 */
const REDUCED = [
    off(["address"]),
    off(["structure"]),
    off(["entrance"]),
    off(["poi", "outdoor", "beach", "medical", "cemetery", "sports_ground"]),
];

/** Road names and green space names go too; a place name and a river stay. */
const MINIMAL = [
    ...REDUCED,
    off(["park", "national_park"]),
    off(["landscape"]),
    off(["road"]),
];

export const LABEL_RULES: Record<LabelDensity, readonly CustomizationEntry[]> = {
    full: [],
    reduced: REDUCED,
    minimal: MINIMAL,
};

/** The sheet with the density's suppression rules appended. */
export function suppressLabels<T extends CustomizationEntry>(sheet: readonly T[], density: LabelDensity): T[] {
    return [...sheet, ...LABEL_RULES[density] as T[]];
}
