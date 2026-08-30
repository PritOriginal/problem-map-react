import { describe, expect, it } from "vitest";

import light from "../../customization.json";
import dark from "../../customization-dark.json";
import { BASEMAP, DARK_PALETTE, LIGHT_PALETTE } from "./basemap";
import { blend, contrast, luminance, recolorSheet } from "./palette";
import { roleOf, stylersOf, type CustomizationEntry } from "./roles";
import { getColorPolygon } from "../map-colors";
import { statusColors } from "../../styles/tokens";
import { heatColors } from "../../utils/heatmap";
import type { AdminBoundaryMarksCount } from "../../services/MapService";

const THEMES = [["light", LIGHT_PALETTE, light], ["dark", DARK_PALETTE, dark]] as const;

/** The wash a district gets when nothing is dealt with, or when everything is. */
function wash(theme: "light" | "dark", open: boolean, level = 10): string {
    const { boundary, palette } = BASEMAP[theme];
    const counts: AdminBoundaryMarksCount = {
        id: 1,
        name: "district",
        total_count: 4,
        unconfirmed_count: 0,
        confirmed_count: open ? 4 : 0,
        under_review_count: 0,
        closed_count: open ? 0 : 4,
    };
    const alpha = (0.01 + 0.09 * Math.exp(level - 10)) * boundary.fillScale;
    return blend("#" + getColorPolygon(counts, boundary.tone), palette.land, alpha);
}

describe("the basemap's own type", () => {
    /**
     * A band, not a floor. The basemap's type is not the content here -- the marks
     * are -- and type set at AA over the ground shouts over the very data it is meant
     * to place. Below ~2.5 it stops being readable at all.
     */
    it.each(THEMES)("%s sets type quietly, but still readably", (_theme, palette) => {
        const onGround = contrast(palette.labelText, palette.land);
        expect(onGround).toBeGreaterThanOrEqual(2.5);
        expect(onGround).toBeLessThanOrEqual(4.5);
    });

    /**
     * The light sheet painted street names #ffffff onto #ffffff road surfaces: a
     * contrast of 1.00, which is not quiet type but absent type. A label has to be
     * measured against what it is actually drawn on, not against the land beside it.
     */
    it.each(THEMES)("%s sets street names against the road surface they sit on", (_theme, palette) => {
        const onRoad = contrast(palette.labelTextRoad, palette.roadFill);
        expect(onRoad).toBeGreaterThanOrEqual(3);
        expect(onRoad).toBeLessThanOrEqual(4.6);
    });

    /**
     * Measured against confirmed (2), the anchor of the status scale and the one a
     * user is looking for -- not against the quietest status, because unconfirmed and
     * duplicate are DRAWN to recede, and because a 32px saturated disc and 11px of
     * grey text are not comparable by contrast ratio alone: size and chroma carry
     * salience that the ratio does not see. The claim is only that the map's type
     * never out-measures the mark it is there to place.
     */
    it.each(THEMES)("%s keeps its type quieter than a confirmed mark", (_theme, palette) => {
        const theme = palette === DARK_PALETTE ? "dark" : "light";
        expect(contrast(palette.labelText, palette.land))
            .toBeLessThan(contrast(statusColors(theme)[2], palette.land));
    });
});

describe("the ground", () => {
    /**
     * The one fault the dark sheet had: road surfaces at #0a0a0a over #131416 land,
     * so the network read as cracks in the ground rather than as the thing you
     * navigate by -- and a marker on a road lost the edge that placed it.
     */
    it.each(THEMES)("%s draws the road network lighter than the land it crosses", (_theme, palette) => {
        expect(luminance(palette.roadFill)).toBeGreaterThan(luminance(palette.land));
    });

    it("keeps each theme on its own side of the line", () => {
        expect(luminance(DARK_PALETTE.land)).toBeLessThan(0.05);
        expect(luminance(LIGHT_PALETTE.land)).toBeGreaterThan(0.7);
    });

    it.each(THEMES)("%s repaints its own sheet without dropping a rule", (_theme, palette, sheet) => {
        const source = sheet as CustomizationEntry[];
        const repainted = recolorSheet(source, palette);
        expect(repainted).toHaveLength(source.length);
        repainted.forEach((entry, index) => {
            expect(entry.tags).toEqual(source[index].tags);
            expect(stylersOf(entry)).toHaveLength(stylersOf(source[index]).length);
        });
    });

    it.each(THEMES)("%s has a colour for every role its sheet actually uses", (_theme, palette, sheet) => {
        const used = new Set((sheet as CustomizationEntry[])
            .filter((entry) => stylersOf(entry).some((styler) => "color" in styler))
            .map(roleOf));
        used.forEach((role) => expect(role && palette[role], String(role)).toMatch(/^#[0-9a-f]{6}$/));
    });
});

describe("the district wash", () => {
    /**
     * What this replaces: a saturated hue at 5% over a near-black ground landed
     * within a couple of 255ths of the ground itself. The colour was there and said
     * nothing, which is worse than no wash -- it costs contrast and pays nothing back.
     */
    it.each(["light", "dark"] as const)("%s tints the ground enough to be seen", (theme) => {
        const ground = luminance(BASEMAP[theme].palette.land);
        expect(Math.abs(luminance(wash(theme, true)) - ground)).toBeGreaterThan(0.008);
        expect(Math.abs(luminance(wash(theme, false)) - ground)).toBeGreaterThan(0.008);
    });

    it.each(["light", "dark"] as const)("%s keeps the two ends of the sweep apart", (theme) => {
        const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
        const open = wash(theme, true);
        const closed = wash(theme, false);
        expect(channel(open, 0)).toBeGreaterThan(channel(open, 1) + 12);
        expect(channel(closed, 1)).toBeGreaterThan(channel(closed, 0) + 12);
    });

    /**
     * The edge used to be drawn in the interface's ink: a grid laid over the map, the
     * loudest thing in the frame, for the least important one. Drawn in the wash's own
     * colour it is quieter -- and says what the district is doing while it is at it.
     */
    it.each(["light", "dark"] as const)("%s draws a quieter edge than the interface ink did", (theme) => {
        const { palette, boundary } = BASEMAP[theme];
        expect(boundary.strokeMode).toBe("self");
        const own = blend(wash(theme, true), palette.land, boundary.strokeOpacity);
        const ink = blend(theme === "dark" ? "#e4e7e9" : "#1b1d1c", palette.land, 0.5);
        expect(contrast(own, palette.land)).toBeLessThan(contrast(ink, palette.land));
    });
});

describe("the data over it", () => {
    it.each(["light", "dark"] as const)("%s holds every status apart from its own ground", (theme) => {
        Object.entries(statusColors(theme)).forEach(([id, color]) => {
            expect(contrast(color, BASEMAP[theme].palette.land), `status ${id}`).toBeGreaterThanOrEqual(2.2);
        });
    });

    /**
     * Confirmed, in progress and under review are red, orange and amber: one axis
     * under deuteranopia, where only lightness is left to tell them apart. Ten points
     * out of a hundred is the floor -- the dark scale this replaced managed four
     * between the first pair on one of its earlier drafts.
     */
    it.each(["light", "dark"] as const)("%s separates red, orange and amber by lightness", (theme) => {
        const scale = statusColors(theme);
        const [confirmed, inProgress, underReview] = [scale[2], scale[7], scale[3]].map(luminance);
        expect((inProgress - confirmed) * 100).toBeGreaterThanOrEqual(9);
        expect((underReview - inProgress) * 100).toBeGreaterThanOrEqual(9);
    });

    /**
     * The other pair deuteranopia collapses: confirmed against closed, red against
     * green -- the two states a user most needs to tell apart. Hue alone does not do
     * it, so they are kept a clear step apart in lightness too.
     */
    it.each(["light", "dark"] as const)("%s separates red from green by lightness", (theme) => {
        const scale = statusColors(theme);
        expect(Math.abs(luminance(scale[2]) - luminance(scale[5])) * 100).toBeGreaterThanOrEqual(9);
    });

    it.each(["light", "dark"] as const)("%s ramps the heat scale away from its own ground", (theme) => {
        const ramp = heatColors(theme);
        const ground = luminance(BASEMAP[theme].palette.land);
        const steps = ramp.map(luminance);
        // strictly monotone, and heading away from the ground rather than towards it
        expect(steps.every((value, i) => i === 0 || value > steps[i - 1])).toBe(theme === "dark");
        expect(Math.abs(steps[steps.length - 1] - ground)).toBeGreaterThan(Math.abs(steps[0] - ground));
    });
});
