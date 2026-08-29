import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CSS_MIRROR, contrastOn, INK, PAPER, STATUS_COLORS } from "./tokens";

/**
 * `src/tokens.scss` is the source of truth for colour. A few of its values are also
 * needed by renderers that cannot resolve `var()` (the WebGL map, the SVG chart), so
 * they are duplicated into `CSS_MIRROR`. This test is what makes that duplication
 * safe -- it fails the moment the two drift, the same guarantee `src/i18n/parity.test.ts`
 * gives the two dictionaries.
 */

/** Parse `--name: value;` pairs out of the `:root` block of the SCSS token file. */
function readScssTokens(): Map<string, string> {
    const source = readFileSync(resolve(__dirname, "../tokens.scss"), "utf8");
    const root = source.slice(source.indexOf(":root"));
    const tokens = new Map<string, string>();
    for (const line of root.split("\n")) {
        const match = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/i.exec(line);
        if (match) {
            tokens.set(match[1], match[2].trim());
        }
    }
    return tokens;
}

/** #abc -> #aabbcc, so shorthand and longhand compare equal. */
function expand(colour: string): string {
    const value = colour.trim().toLowerCase();
    const hex = /^#([0-9a-f]{3,4})$/.exec(value);
    return hex ? "#" + [...hex[1]].map((c) => c + c).join("") : value;
}

describe("design token parity", () => {
    const scss = readScssTokens();

    it("parses the SCSS token file", () => {
        expect(scss.size).toBeGreaterThan(50);
        expect(scss.get("--panel-width")).toBe("420px");
    });

    it.each(Object.keys(CSS_MIRROR))("%s matches src/tokens.scss", (name) => {
        const fromScss = scss.get(name);
        expect(fromScss, `${name} is missing from src/tokens.scss`).toBeDefined();
        expect(expand(fromScss!)).toBe(expand(CSS_MIRROR[name as keyof typeof CSS_MIRROR]));
    });

    it("mirrors only tokens that actually exist in the stylesheet", () => {
        const unknown = Object.keys(CSS_MIRROR).filter((name) => !scss.has(name));
        expect(unknown).toEqual([]);
    });
});

describe("status colours", () => {
    it("covers every status id the backend can send", () => {
        expect(Object.keys(STATUS_COLORS).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("gives every status a full-length hex value", () => {
        for (const [id, colour] of Object.entries(STATUS_COLORS)) {
            expect(colour, `status ${id}`).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });
});

describe("contrastOn", () => {
    it("puts light ink on dark fills and dark ink on light fills", () => {
        expect(contrastOn("#000000")).toBe(PAPER);
        expect(contrastOn("#e50000")).toBe(PAPER);
        expect(contrastOn("#ffffff")).toBe(INK);
        expect(contrastOn("#e5d600")).toBe(INK);
    });

    it("judges saturated colours by luminance, not by channel average", () => {
        // #1f77b4 averages to a mid grey but is dark to the eye: it needs light ink.
        expect(contrastOn("#1f77b4")).toBe(PAPER);
        // #00e500 averages lower still, yet reads bright: it needs dark ink.
        expect(contrastOn("#00e500")).toBe(INK);
    });

    it("accepts shorthand hex and falls back safely on junk", () => {
        expect(contrastOn("#fff")).toBe(INK);
        expect(contrastOn("#000")).toBe(PAPER);
        expect(contrastOn("not-a-colour")).toBe(INK);
    });
});
