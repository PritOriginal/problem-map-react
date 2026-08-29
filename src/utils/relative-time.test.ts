import { describe, expect, it } from "vitest";
import { JUST_NOW_MS, RELATIVE_LIMIT_MS, relativeTime } from "./relative-time";

const NOW = Date.parse("2026-08-29T19:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("relativeTime", () => {
    it("calls anything under a minute 'now'", () => {
        expect(relativeTime(ago(0), NOW)).toEqual({ kind: "now" });
        expect(relativeTime(ago(JUST_NOW_MS - 1), NOW)).toEqual({ kind: "now" });
    });

    it("treats a future timestamp as 'now' rather than a negative span", () => {
        expect(relativeTime(ago(-60_000), NOW)).toEqual({ kind: "now" });
    });

    it("counts minutes, then hours, then days", () => {
        expect(relativeTime(ago(12 * 60_000), NOW)).toEqual({ kind: "span", value: 12, unit: "minutes" });
        expect(relativeTime(ago(5 * 3_600_000), NOW)).toEqual({ kind: "span", value: 5, unit: "hours" });
        expect(relativeTime(ago(3 * 86_400_000), NOW)).toEqual({ kind: "span", value: 3, unit: "days" });
    });

    it("falls back to an absolute date at the limit", () => {
        expect(relativeTime(ago(RELATIVE_LIMIT_MS - 1), NOW).kind).toBe("span");
        expect(relativeTime(ago(RELATIVE_LIMIT_MS), NOW)).toEqual({ kind: "absolute" });
    });

    it("falls back to an absolute date for an unparsable value", () => {
        expect(relativeTime("not a date", NOW)).toEqual({ kind: "absolute" });
    });
});
