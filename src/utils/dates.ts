const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Start of the local day for a `YYYY-MM-DD` string as RFC3339 (UTC); other strings pass through. */
export function dayStartRfc3339(value: string): string {
    const m = DATE_ONLY.exec(value);
    if (!m) {
        return value;
    }
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toISOString();
}

/** End of the local day (23:59:59.999) for a `YYYY-MM-DD` string as RFC3339 (UTC); other strings pass through. */
export function dayEndRfc3339(value: string): string {
    const m = DATE_ONLY.exec(value);
    if (!m) {
        return value;
    }
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999).toISOString();
}

/**
 * Converts a `from`/`to` pair from `<input type="date">` (`YYYY-MM-DD`) to the RFC3339 range the
 * backend expects: `from` is the start of the day, `to` is the end of the day, both in the local
 * time zone. Strings that are already RFC3339 are passed through unchanged; empty values are dropped.
 */
export function toRfc3339Range(from?: string, to?: string): { from?: string; to?: string } {
    return {
        from: from ? dayStartRfc3339(from) : undefined,
        to: to ? dayEndRfc3339(to) : undefined,
    };
}

/**
 * A `YYYY-MM-DD` day, written the way the locale writes days.
 *
 * Built out of the three parts rather than `new Date(iso)`: that constructor reads
 * a bare date as UTC midnight, so west of Greenwich `toLocaleDateString` hands back
 * the previous day -- and this string is the answer to "which period am I looking
 * at", where being a day off is the whole failure.
 */
export function formatDay(iso: string, locale: string): string {
    const [year, month, day] = iso.split("-").map(Number);
    if (!year || !month || !day) {
        return iso;
    }
    return new Date(year, month - 1, day).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}
