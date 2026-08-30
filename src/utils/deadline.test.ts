import { beforeEach, describe, expect, it } from "vitest";
import { deadlineState, formatDeadline, formatDuration, formatSla } from "./deadline";
import { setLang } from "../i18n";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-08-29T12:00:00Z");

describe("formatDuration", () => {
    beforeEach(() => setLang("ru"));

    it("uses at most two units", () => {
        expect(formatDuration(3 * DAY + 4 * HOUR + 30 * 60_000)).toBe("3 дн 4 ч");
        expect(formatDuration(2 * DAY)).toBe("2 дн");
        expect(formatDuration(4 * HOUR + 15 * 60_000)).toBe("4 ч 15 мин");
        expect(formatDuration(HOUR)).toBe("1 ч");
        expect(formatDuration(15 * 60_000)).toBe("15 мин");
        expect(formatDuration(20_000)).toBe("< 1 мин");
        expect(formatDuration(-5 * HOUR)).toBe("< 1 мин");
    });

    it("is localized", () => {
        expect(formatDuration(DAY + HOUR, "en")).toBe("1 d 1 h");
        expect(formatDuration(5 * 60_000, "en")).toBe("5 min");
    });
});

describe("deadlineState", () => {
    it("returns null without a deadline or for malformed values", () => {
        expect(deadlineState(null, NOW)).toBeNull();
        expect(deadlineState(undefined, NOW)).toBeNull();
        expect(deadlineState("", NOW)).toBeNull();
        expect(deadlineState("not a date", NOW)).toBeNull();
    });

    it("flags overdue and soon", () => {
        expect(deadlineState(new Date(NOW + 3 * DAY).toISOString(), NOW)).toEqual({ remainingMs: 3 * DAY, overdue: false, soon: false });
        expect(deadlineState(new Date(NOW + 2 * HOUR).toISOString(), NOW)).toMatchObject({ overdue: false, soon: true });
        expect(deadlineState(new Date(NOW - HOUR).toISOString(), NOW)).toMatchObject({ remainingMs: -HOUR, overdue: true, soon: false });
    });
});

describe("formatDeadline / formatSla", () => {
    beforeEach(() => setLang("ru"));

    it("formats the remaining time and the overdue time", () => {
        expect(formatDeadline(new Date(NOW + 2 * DAY + 3 * HOUR).toISOString(), NOW)).toBe("Осталось 2 дн 3 ч");
        expect(formatDeadline(new Date(NOW - 4 * HOUR).toISOString(), NOW)).toBe("Просрочено на 4 ч");
        expect(formatDeadline(null, NOW)).toBe("");
        expect(formatSla(new Date(NOW + DAY).toISOString(), NOW)).toBe("SLA: осталось 1 дн");
        expect(formatSla(new Date(NOW - 30 * 60_000).toISOString(), NOW)).toBe("SLA: просрочено на 30 мин");
        expect(formatSla(undefined, NOW)).toBe("");
    });

    it("follows the explicit language", () => {
        expect(formatDeadline(new Date(NOW - 4 * HOUR).toISOString(), NOW, "en")).toBe("Overdue by 4 h");
        expect(formatSla(new Date(NOW + DAY).toISOString(), NOW, "en")).toBe("SLA: 1 d left");
    });
});
