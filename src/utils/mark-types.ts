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

/** `#rgb`/`#rrggbb`/`#rrggbbaa` check for the admin form. */
export function isHexColor(value: string): boolean {
    return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim());
}
