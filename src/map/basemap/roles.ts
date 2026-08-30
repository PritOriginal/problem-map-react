/**
 * Semantic roles of the vector basemap, and the classifier that assigns one to
 * every styled entry of a Yandex customization sheet.
 *
 * The dark sheet in `src/customization-dark.json` names 81 distinct hex values
 * across 128 entries, but they are not 81 decisions -- they are ~25 decisions
 * plus a per-zoom ramp around each. Repainting the map by hand therefore means
 * editing hundreds of literals and hoping the ramps stay consistent; repainting
 * it by ROLE means editing one colour per role, which is few enough to hold in
 * the head, to argue with, and to test. The roles live here; the palettes that
 * fill them, one per theme, live in `basemap.ts`.
 *
 * A role is derived from the entry's `tags`/`elements` -- never from the colour
 * it currently carries, which would tie a palette to the sheet it started from.
 */

export type MapRole =
    // administrative wash outside the mapped area
    | "adminFill"
    | "adminOutline"
    // ground
    | "land"
    | "landUrban"
    | "landIndustrial"
    | "green"
    | "sport"
    | "water"
    // built form
    | "buildingFill"
    | "buildingOutline"
    | "fence"
    // road network
    | "roadFill"
    | "roadOutline"
    | "roadPattern"
    | "roadTunnel"
    | "roadLimited"
    | "roadConstructionFill"
    | "roadConstructionOutline"
    | "pathFill"
    | "pathOutline"
    // transit and other lines
    | "transit"
    // type
    | "labelText"
    | "labelTextStrong"
    | "labelTextRoad"
    | "labelTextWater"
    | "labelOutline"
    | "labelIcon";

export const MAP_ROLES: readonly MapRole[] = [
    "adminFill", "adminOutline",
    "land", "landUrban", "landIndustrial", "green", "sport", "water",
    "buildingFill", "buildingOutline", "fence",
    "roadFill", "roadOutline", "roadPattern", "roadTunnel", "roadLimited",
    "roadConstructionFill", "roadConstructionOutline", "pathFill", "pathOutline",
    "transit",
    "labelText", "labelTextStrong", "labelTextRoad", "labelTextWater", "labelOutline", "labelIcon",
];

/** The shape of one entry of a customization sheet, as far as recolouring cares. */
export interface CustomizationEntry {
    tags?: string | string[] | { any?: string | string[]; all?: string | string[]; none?: string | string[] };
    elements?: string;
    /** A single styler or a list of them -- the sheet uses both forms. */
    stylers?: Record<string, unknown> | Record<string, unknown>[];
    [key: string]: unknown;
}

/** The entry's stylers, always as a list. Visibility-only rules use the object form. */
export function stylersOf(entry: CustomizationEntry): Record<string, unknown>[] {
    const { stylers } = entry;
    if (!stylers) {
        return [];
    }
    return Array.isArray(stylers) ? stylers : [stylers];
}

function asArray(value: string | string[] | undefined): string[] {
    if (value === undefined) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

/**
 * The tags an entry positively selects on. `none` is deliberately dropped: every
 * distinction the sheet draws with it (`is_tunnel` vs not, `path` vs not) is
 * already drawn by the positive side, and reading both would double the rules.
 */
export function positiveTags(entry: CustomizationEntry): Set<string> {
    const { tags } = entry;
    if (!tags) {
        return new Set();
    }
    if (typeof tags === "string" || Array.isArray(tags)) {
        return new Set(asArray(tags));
    }
    return new Set([...asArray(tags.any), ...asArray(tags.all)]);
}

const ROAD_CLASSES = [
    "road_1", "road_2", "road_3", "road_4", "road_5", "road_6", "road_7",
    "road_minor", "road_unclassified",
];

const STRONG_LABELS = ["structure", "entrance", "address", "landscape"];

/**
 * The role of one entry, or `null` when it styles nothing that carries a colour
 * (visibility-only rules, of which the sheet has a dozen).
 *
 * Order matters: the narrow tags are tested before the broad ones, because
 * `road_construction` is also `road` and a park is also `land`.
 */
export function roleOf(entry: CustomizationEntry): MapRole | null {
    const tags = positiveTags(entry);
    const has = (tag: string) => tags.has(tag);
    const elements = entry.elements ?? "";

    // ---- type ----------------------------------------------------------
    if (elements.startsWith("label")) {
        if (elements.startsWith("label.text.outline")) {
            return "labelOutline";
        }
        if (elements.startsWith("label.icon")) {
            return "labelIcon";
        }
        if (has("road")) {
            return "labelTextRoad";
        }
        if (has("water")) {
            return "labelTextWater";
        }
        if (STRONG_LABELS.some(has)) {
            return "labelTextStrong";
        }
        return "labelText";
    }

    const outline = elements.endsWith("outline");

    // ---- built form ----------------------------------------------------
    if (has("building")) {
        return outline ? "buildingOutline" : "buildingFill";
    }
    if (has("fence")) {
        return "fence";
    }

    // ---- road network --------------------------------------------------
    if (has("road_construction")) {
        return outline ? "roadConstructionOutline" : "roadConstructionFill";
    }
    if (has("path")) {
        return outline ? "pathOutline" : "pathFill";
    }
    if (has("is_tunnel")) {
        return "roadTunnel";
    }
    if (has("road_limited")) {
        return "roadLimited";
    }
    if (ROAD_CLASSES.some(has)) {
        return outline ? "roadOutline" : "roadFill";
    }
    if (has("road")) {
        return elements.includes("pattern") ? "roadPattern" : "roadFill";
    }

    // ---- lines that are neither road nor ground ------------------------
    if (has("transit_line") || has("transit_schema") || has("ferry") || has("geographic_line")) {
        return "transit";
    }

    // ---- ground --------------------------------------------------------
    if (has("water") || has("bathymetry")) {
        return "water";
    }
    if (has("sports_ground")) {
        return "sport";
    }
    if (has("vegetation") || has("park") || has("national_park") || has("cemetery")) {
        return "green";
    }
    if (has("country") || has("region") || has("admin")) {
        return outline ? "adminOutline" : "adminFill";
    }
    if (has("urban_area")) {
        return "landUrban";
    }
    if (has("industrial") || has("construction_site") || has("medical") || has("beach") || has("transit")) {
        return "landIndustrial";
    }
    if (has("land") || has("locality") || has("residential") || has("structure") || has("terrain") || has("landcover")) {
        return "land";
    }

    return null;
}
