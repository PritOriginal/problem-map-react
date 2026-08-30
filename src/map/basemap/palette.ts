/**
 * Repainting a vector basemap from one colour per role.
 *
 * A customization sheet does not give a role one colour: it gives it a ramp, one
 * step per zoom, so that a district reads as a wash at z8 and as ground at z18.
 * Throwing that ramp away and flooding a role with a single flat colour is what
 * makes a hand-recoloured basemap look like a screenshot with the hue slider
 * dragged. So the repaint keeps the SHAPE of every ramp and moves only where it
 * sits: each colour of an entry is re-expressed as its lightness offset from the
 * entry's first colour, and that offset is replayed on the palette's colour for
 * the role. Hue and saturation come from the palette, the modelling comes from
 * the sheet.
 *
 * The result is a theme's ground defined by ~27 hex values (see `MapPalette`)
 * rather than by 81 literals scattered over 128 entries -- which is what makes it
 * possible to state, and to test, what the ground is actually doing.
 */

import { roleOf, stylersOf, type CustomizationEntry, type MapRole } from "./roles";

/** One colour per basemap role. Every role must be present -- `basemap.test.ts` checks it. */
export type MapPalette = Record<MapRole, string>;

export interface Hsl {
    h: number;
    s: number;
    l: number;
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#abc` and `#aabbcc`, with or without the hash, to HSL (h in degrees, s/l in 0..1). */
export function hexToHsl(hex: string): Hsl {
    const match = HEX.exec(hex.trim());
    if (!match) {
        throw new Error(`not a hex colour: ${hex}`);
    }
    const digits = match[1].length === 3 ? [...match[1]].map((c) => c + c).join("") : match[1];
    const r = parseInt(digits.slice(0, 2), 16) / 255;
    const g = parseInt(digits.slice(2, 4), 16) / 255;
    const b = parseInt(digits.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const chroma = max - min;
    if (chroma === 0) {
        return { h: 0, s: 0, l };
    }
    const s = chroma / (1 - Math.abs(2 * l - 1));
    let h: number;
    if (max === r) {
        h = 60 * (((g - b) / chroma) % 6);
    } else if (max === g) {
        h = 60 * ((b - r) / chroma + 2);
    } else {
        h = 60 * ((r - g) / chroma + 4);
    }
    return { h: (h + 360) % 360, s, l };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** HSL back to a lowercase `#rrggbb`. */
export function hslToHex({ h, s, l }: Hsl): string {
    const light = clamp01(l);
    const sat = clamp01(s);
    const chroma = (1 - Math.abs(2 * light - 1)) * sat;
    const hue = ((h % 360) + 360) % 360 / 60;
    const x = chroma * (1 - Math.abs((hue % 2) - 1));
    const [r, g, b] = hue < 1 ? [chroma, x, 0]
        : hue < 2 ? [x, chroma, 0]
        : hue < 3 ? [0, chroma, x]
        : hue < 4 ? [0, x, chroma]
        : hue < 5 ? [x, 0, chroma]
        : [chroma, 0, x];
    const m = light - chroma / 2;
    return "#" + [r, g, b]
        .map((channel) => Math.round(clamp01(channel + m) * 255).toString(16).padStart(2, "0"))
        .join("");
}

/** WCAG relative luminance, for the contrast assertions the palettes are held to. */
export function luminance(hex: string): number {
    const { h, s, l } = hexToHsl(hex);
    const rgbHex = hslToHex({ h, s, l }).slice(1);
    const channels = [0, 2, 4].map((i) => {
        const value = parseInt(rgbHex.slice(i, i + 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** `top` laid over `bottom` at `alpha`, the way the map composites a district wash. */
export function blend(top: string, bottom: string, alpha: number): string {
    const mix = (a: string, b: string) => {
        const channel = (hex: string, i: number) => parseInt(hslToHex(hexToHsl(hex)).slice(1).slice(i * 2, i * 2 + 2), 16);
        return "#" + [0, 1, 2]
            .map((i) => Math.round(clamp01(alpha) * channel(a, i) + (1 - clamp01(alpha)) * channel(b, i)))
            .map((value) => value.toString(16).padStart(2, "0"))
            .join("");
    };
    return mix(top, bottom);
}

/** WCAG contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
}

/**
 * One repainted colour: the palette's hue and saturation, at the palette's
 * lightness shifted by however far this step sat from its ramp's first step.
 */
function shifted(base: Hsl, delta: number): string {
    return hslToHex({ h: base.h, s: base.s, l: base.l + delta });
}

/**
 * A copy of `sheet` with every colour replaced by the palette's colour for that
 * entry's role. Entries the classifier does not recognise, and stylers that carry
 * no colour, are passed through untouched -- a repaint must never drop a rule.
 */
export function recolorSheet<T extends CustomizationEntry>(sheet: readonly T[], palette: MapPalette): T[] {
    return sheet.map((entry) => {
        const role = roleOf(entry);
        const stylers = stylersOf(entry);
        if (!role || stylers.length === 0) {
            return entry;
        }

        const base = hexToHsl(palette[role]);
        let anchor: number | null = null;
        let touched = false;

        const repainted = stylers.map((styler) => {
            const colour = styler.color;
            if (typeof colour !== "string" || !HEX.test(colour)) {
                return styler;
            }
            const { l } = hexToHsl(colour);
            if (anchor === null) {
                anchor = l;
            }
            touched = true;
            return { ...styler, color: shifted(base, l - anchor) };
        });

        if (!touched) {
            return entry;
        }
        // The sheet's object form is preserved: the SDK accepts both, and rewriting
        // a visibility-only rule into a one-element list is a change nobody asked for.
        return { ...entry, stylers: Array.isArray(entry.stylers) ? repainted : repainted[0] };
    });
}

