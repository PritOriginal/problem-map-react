import type { MarkType } from "../services/MarksService";

/** Marker color of a type when the backend sends one (`#rrggbb` / `rgb()` / a named color). */
export function typeColor(type: MarkType | undefined): string | undefined {
    const color = type?.color?.trim();
    return color ? color : undefined;
}

/** Icon of a type when the backend sends one; only short glyphs (emoji / 1-2 chars) are used inline. */
export function typeIcon(type: MarkType | undefined): string | undefined {
    const icon = type?.icon?.trim();
    if (!icon) {
        return undefined;
    }
    return Array.from(icon).length <= 2 ? icon : undefined;
}

/**
 * `#rrggbb` check for the admin form.
 *
 * Exactly six digits, because that is what the backend accepts: `color` is
 * validated as `len=7` when a type is created and `max=7` when it is updated.
 * Accepting `#rgb` and `#rrggbbaa` here only moved the rejection to the server,
 * where it arrives as a bare 400 after the form has already said the value is fine.
 */
export function isHexColor(value: string): boolean {
    return /^#[0-9a-f]{6}$/i.test(value.trim());
}

/**
 * Ink that reads on a filled swatch of `hex`.
 *
 * Not a token: the colour underneath comes from the backend (a mark type) or from
 * the status scale, so which of the two inks wins is a decision made per value at
 * runtime. Computed from WCAG relative luminance rather than guessed from the
 * hue -- `#f4b71a` and `#43474a` are both "a colour", and only one of them takes
 * white text.
 *
 * Returns literals, not `var()`: the two inks must not follow the theme. The
 * swatch is the same colour in both themes, so its text has to be too.
 */
export function contrastOn(hex: string): string {
    const rgb = parseHex(hex);
    if (!rgb) {
        return DARK_INK;
    }
    const luminance =
        0.2126 * channel(rgb[0]) +
        0.7152 * channel(rgb[1]) +
        0.0722 * channel(rgb[2]);
    // Contrast against white is 1.05 / (L + 0.05); against black, (L + 0.05) / 0.05.
    // They cross at L = 0.1791, which is the threshold below.
    return luminance > 0.1791 ? DARK_INK : LIGHT_INK;
}

const DARK_INK = "#1b1d1c";
const LIGHT_INK = "#ffffff";

/** `#rgb` / `#rrggbb` (with or without alpha, which does not affect luminance). */
function parseHex(value: string): [number, number, number] | null {
    const hex = value.trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(hex)) {
        return [
            parseInt(hex[0] + hex[0], 16),
            parseInt(hex[1] + hex[1], 16),
            parseInt(hex[2] + hex[2], 16),
        ];
    }
    if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) {
        return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16),
        ];
    }
    return null;
}

/** sRGB channel to its linear-light value. */
function channel(value: number): number {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
