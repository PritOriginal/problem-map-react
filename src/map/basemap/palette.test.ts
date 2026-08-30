import { describe, expect, it } from "vitest";

import dark from "../../customization-dark.json";
import { blend, contrast, hexToHsl, hslToHex, luminance, recolorSheet } from "./palette";
import { roleOf, stylersOf, type CustomizationEntry } from "./roles";
import { DARK_PALETTE } from "./basemap";

const SHEET = dark as CustomizationEntry[];


const colorsOf = (entry: CustomizationEntry) => stylersOf(entry)
    .map((styler) => styler.color)
    .filter((color): color is string => typeof color === "string");

describe("colour conversion", () => {
    it("round-trips a hex through HSL", () => {
        for (const hex of ["#000000", "#ffffff", "#131416", "#ff2e88", "#2fa55a", "#0a0a0a"]) {
            expect(hslToHex(hexToHsl(hex))).toBe(hex);
        }
    });

    it("expands the three-digit form", () => {
        expect(hslToHex(hexToHsl("#abc"))).toBe("#aabbcc");
    });

    it("rejects anything that is not a colour", () => {
        expect(() => hexToHsl("rgba(0,0,0,1)")).toThrow();
    });

    it("agrees with WCAG on the two extremes", () => {
        expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
        expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5);
    });
});

describe("recolouring the basemap", () => {
    const palette = DARK_PALETTE;
    const repainted = recolorSheet(SHEET, palette);

    it("keeps every rule the sheet had", () => {
        expect(repainted).toHaveLength(SHEET.length);
        repainted.forEach((entry, index) => {
            expect(entry.tags).toEqual(SHEET[index].tags);
            expect(entry.elements).toBe(SHEET[index].elements);
            expect(stylersOf(entry)).toHaveLength(stylersOf(SHEET[index]).length);
        });
    });

    it("replaces every colour and nothing else", () => {
        repainted.forEach((entry, index) => {
            const before = stylersOf(SHEET[index]);
            stylersOf(entry).forEach((styler, i) => {
                Object.entries(styler).forEach(([key, value]) => {
                    if (key === "color") {
                        expect(value).toMatch(/^#[0-9a-f]{6}$/);
                    } else {
                        expect(value).toEqual(before[i][key]);
                    }
                });
            });
        });
    });

    it("leaves a visibility-only rule in its object form", () => {
        const index = SHEET.findIndex((entry) => !Array.isArray(entry.stylers));
        expect(index).toBeGreaterThan(-1);
        expect(Array.isArray(repainted[index].stylers)).toBe(false);
    });

    it("keeps the shape of each zoom ramp", () => {
        // `land` fades over 22 zoom steps; a flat flood would read as a different map.
        const index = SHEET.findIndex((entry) => entry.tags === "land");
        const before = colorsOf(SHEET[index]).map(luminance);
        const after = colorsOf(repainted[index]).map(luminance);
        expect(after).toHaveLength(before.length);
        // Direction per step, not distance: an original step of one 255th can quantise
        // to nothing on a differently saturated ground, but it must never reverse.
        for (let i = 1; i < before.length; i++) {
            expect([0, Math.sign(before[i] - before[i - 1])]).toContain(Math.sign(after[i] - after[i - 1]));
        }
        expect(Math.sign(after[after.length - 1] - after[0])).toBe(Math.sign(before[before.length - 1] - before[0]));
    });

    it("paints a role's colour, not the sheet's", () => {
        const index = SHEET.findIndex((entry) => roleOf(entry) === "water");
        expect(hexToHsl(colorsOf(repainted[index])[0]).h).toBeCloseTo(hexToHsl(palette.water).h, 0);
    });
});

describe("blending", () => {
    it("returns the ground at zero alpha and the wash at one", () => {
        expect(blend("#ff0000", "#101010", 0)).toBe("#101010");
        expect(blend("#ff0000", "#101010", 1)).toBe("#ff0000");
    });

    it("lands halfway at a half", () => {
        expect(blend("#ffffff", "#000000", 0.5)).toBe("#808080");
    });
});
