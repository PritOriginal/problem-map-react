import { describe, expect, it } from "vitest";

import dark from "../../customization-dark.json";
import light from "../../customization.json";
import { MAP_ROLES, roleOf, stylersOf, type CustomizationEntry } from "./roles";

const DARK = dark as CustomizationEntry[];
const LIGHT = light as CustomizationEntry[];

/** Entries that actually paint something -- the only ones a repaint has to cover. */
function coloured(sheet: CustomizationEntry[]): CustomizationEntry[] {
    return sheet.filter((entry) => stylersOf(entry).some((styler) => "color" in styler));
}

describe("basemap role classifier", () => {
    it.each([["dark", DARK], ["light", LIGHT]] as const)("classifies every coloured entry of the %s sheet", (_name, sheet) => {
        const unclassified = coloured(sheet).filter((entry) => roleOf(entry) === null);
        expect(unclassified.map((entry) => JSON.stringify(entry.tags) + "|" + entry.elements)).toEqual([]);
    });

    it("uses every role it declares", () => {
        const used = new Set(coloured(DARK).map(roleOf));
        expect(MAP_ROLES.filter((role) => !used.has(role))).toEqual([]);
    });

    it("separates a road's fill from its outline", () => {
        expect(roleOf({ tags: { any: "road_1", none: "is_tunnel" }, elements: "geometry.fill" })).toBe("roadFill");
        expect(roleOf({ tags: { any: "road_1" }, elements: "geometry.outline" })).toBe("roadOutline");
    });

    it("reads a road label as type, not as road surface", () => {
        expect(roleOf({ tags: "road", elements: "label.text.fill" })).toBe("labelTextRoad");
        expect(roleOf({ tags: "road", elements: "geometry.fill.pattern" })).toBe("roadPattern");
    });

    it("prefers the narrow tag over the broad one it also carries", () => {
        expect(roleOf({ tags: "road_construction", elements: "geometry.fill" })).toBe("roadConstructionFill");
        expect(roleOf({ tags: "park", elements: "geometry" })).toBe("green");
    });

    it("returns null for a rule that only toggles visibility", () => {
        expect(roleOf({ tags: { any: "poi" }, stylers: [{ visibility: "off" }] })).toBeNull();
    });
});
