import { describe, expect, it } from "vitest";
import { STATUS_COLORS, STATUS_COLORS_DARK } from "../styles/tokens";
import { contrastOn, isHexColor, typeColor, typeIcon } from "./mark-types";

describe("typeColor", () => {
    it("gives the colour when the backend sends one", () => {
        expect(typeColor({ mark_type_id: 1, name: "", color: "#f07316" })).toBe("#f07316");
    });

    it("treats blank and missing alike", () => {
        expect(typeColor({ mark_type_id: 1, name: "", color: "   " })).toBeUndefined();
        expect(typeColor({ mark_type_id: 1, name: "" })).toBeUndefined();
        expect(typeColor(undefined)).toBeUndefined();
    });
});

describe("typeIcon", () => {
    it("keeps a short glyph", () => {
        expect(typeIcon({ mark_type_id: 1, name: "", icon: "🗑" })).toBe("🗑");
    });

    it("drops anything longer than two characters", () => {
        expect(typeIcon({ mark_type_id: 1, name: "", icon: "мусор" })).toBeUndefined();
    });
});

describe("isHexColor", () => {
    it("accepts the three notations the admin form allows", () => {
        expect(isHexColor("#abc")).toBe(true);
        expect(isHexColor("#AABBCC")).toBe(true);
        expect(isHexColor("#aabbccdd")).toBe(true);
    });

    it("rejects everything else", () => {
        expect(isHexColor("")).toBe(false);
        expect(isHexColor("aabbcc")).toBe(false);
        expect(isHexColor("#gggggg")).toBe(false);
    });
});

describe("contrastOn", () => {
    it("puts dark ink on a light swatch and light ink on a dark one", () => {
        expect(contrastOn("#ffffff")).toBe("#1b1d1c");
        expect(contrastOn("#f4b71a")).toBe("#1b1d1c");
        expect(contrastOn("#000000")).toBe("#ffffff");
        expect(contrastOn("#43474a")).toBe("#ffffff");
    });

    it("reads short hex and ignores alpha", () => {
        expect(contrastOn("#fff")).toBe("#1b1d1c");
        expect(contrastOn("#000000ff")).toBe("#ffffff");
    });

    it("falls back to dark ink on anything it cannot parse", () => {
        // The colour comes from the backend, so it can be a named colour or junk.
        // Dark ink on the light surfaces those swatches sit on is the safer miss.
        expect(contrastOn("rebeccapurple")).toBe("#1b1d1c");
        expect(contrastOn("")).toBe("#1b1d1c");
    });

    // The status scale is what this is actually used on, and a status label that
    // fails contrast is a label nobody reads. 4.5:1 is the WCAG floor for text.
    it("clears 4.5:1 on every status colour, in both scales", () => {
        for (const scale of [STATUS_COLORS, STATUS_COLORS_DARK]) {
            for (const [id, color] of Object.entries(scale)) {
                expect(ratio(color, contrastOn(color)), `status ${id} (${color})`).toBeGreaterThanOrEqual(4.5);
            }
        }
    });
});

/** WCAG contrast ratio, kept in the test so the helper's threshold is checked, not restated. */
function ratio(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

function luminance(hex: string): number {
    const value = hex.replace("#", "");
    const channels = [0, 2, 4].map((i) => {
        const c = parseInt(value.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
