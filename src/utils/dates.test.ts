import { describe, expect, it } from "vitest";
import { dayEndRfc3339, dayStartRfc3339, formatDay, toRfc3339Range } from "./dates";

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("toRfc3339Range", () => {
    it("expands YYYY-MM-DD to local day start / end in RFC3339", () => {
        const { from, to } = toRfc3339Range("2026-01-05", "2026-02-10");
        expect(from).toMatch(RFC3339);
        expect(to).toMatch(RFC3339);
        expect(from).toBe(new Date(2026, 0, 5).toISOString());
        expect(to).toBe(new Date(2026, 1, 10, 23, 59, 59, 999).toISOString());
        expect(new Date(to!).getTime() - new Date(from!).getTime()).toBeGreaterThan(36 * 24 * 3600 * 1000);
    });

    it("passes RFC3339 strings through unchanged", () => {
        const iso = "2026-01-05T10:20:30Z";
        expect(toRfc3339Range(iso, iso)).toEqual({ from: iso, to: iso });
        expect(dayStartRfc3339(iso)).toBe(iso);
        expect(dayEndRfc3339(iso)).toBe(iso);
    });

    it("drops empty values", () => {
        expect(toRfc3339Range(undefined, "")).toEqual({ from: undefined, to: undefined });
        expect(toRfc3339Range("2026-01-05")).toMatchObject({ to: undefined });
        expect(toRfc3339Range("2026-01-05").from).toMatch(RFC3339);
    });
});

describe("formatDay", () => {
    it("writes the day the locale's way", () => {
        expect(formatDay("2026-06-01", "ru-RU")).toBe("01.06.2026");
    });

    it("keeps the day it was given, whatever the zone", () => {
        // `new Date("2026-06-01")` is UTC midnight, which is 31 May in any zone west
        // of Greenwich. The parts are read as local, so the day never shifts.
        expect(formatDay("2026-06-01", "en-US")).toBe("06/01/2026");
    });

    it("gives back anything it cannot read", () => {
        expect(formatDay("", "ru-RU")).toBe("");
        expect(formatDay("сегодня", "ru-RU")).toBe("сегодня");
    });
});
