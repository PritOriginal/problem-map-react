import { describe, expect, it } from "vitest";

import dark from "../../customization-dark.json";
import { LABEL_RULES, suppressLabels, type LabelDensity } from "./labels";
import { stylersOf, type CustomizationEntry } from "./roles";
import { BASEMAP } from "./basemap";

const SHEET = dark as CustomizationEntry[];

/** The tags a density switches off, flattened. */
function hidden(density: LabelDensity): string[] {
    return LABEL_RULES[density].flatMap((rule) => {
        const tags = rule.tags;
        return typeof tags === "object" && tags !== null && !Array.isArray(tags) ? [...(tags.any as string[])] : [];
    });
}

describe("label density", () => {
    it("changes nothing at all on the control arm", () => {
        expect(suppressLabels(SHEET, "full")).toHaveLength(SHEET.length);
    });

    it("appends its rules after the sheet's own, so they win", () => {
        const result = suppressLabels(SHEET, "reduced");
        expect(result.slice(0, SHEET.length)).toEqual(SHEET);
        expect(result.length).toBe(SHEET.length + LABEL_RULES.reduced.length);
    });

    it("switches off the classes it names, and only labels", () => {
        suppressLabels<CustomizationEntry>([], "minimal").forEach((rule) => {
            expect(rule.elements).toBe("label");
            expect(stylersOf(rule)).toEqual([{ visibility: "off" }]);
        });
    });

    it("drops house numbers and amenities first -- the bulk of the type", () => {
        expect(hidden("reduced")).toEqual(expect.arrayContaining(["address", "structure", "entrance", "poi"]));
    });

    it("keeps place names and water at every density", () => {
        (["reduced", "minimal"] as const).forEach((density) => {
            expect(hidden(density)).not.toContain("locality");
            expect(hidden(density)).not.toContain("water");
        });
    });

    it("gives up road names only at the sparsest setting", () => {
        expect(hidden("reduced")).not.toContain("road");
        expect(hidden("minimal")).toContain("road");
    });

    it("is a superset as it gets sparser", () => {
        expect(hidden("minimal")).toEqual(expect.arrayContaining(hidden("reduced")));
    });
});

describe("what the themes ask for", () => {
    it("thins the type on both themes, not just the dark one", () => {
        expect(BASEMAP.light.labels).toBe("reduced");
        expect(BASEMAP.dark.labels).toBe("reduced");
    });
});
