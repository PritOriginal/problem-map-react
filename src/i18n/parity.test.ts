import { describe, expect, it } from "vitest";
import { ru } from "./ru";
import { en } from "./en";

/** Every wave-5 screen must be translated in both dictionaries (no silent ru fallback in en). */
describe("i18n dictionaries parity", () => {
    const ruKeys = Object.keys(ru);
    const enKeys = Object.keys(en);

    it("en has every ru key", () => {
        expect(ruKeys.filter((key) => !(key in en))).toEqual([]);
    });

    it("en has no keys unknown to ru", () => {
        expect(enKeys.filter((key) => !(key in ru))).toEqual([]);
    });

    it("covers the wave-5 screens", () => {
        for (const prefix of ["report.", "moderation.", "comments.", "admin.", "offline.", "leaderboard.period.", "profile.level"]) {
            expect(ruKeys.some((key) => key.startsWith(prefix))).toBe(true);
        }
    });

    it("keeps the same placeholders in both languages", () => {
        const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
        for (const key of ruKeys) {
            const enValue = en[key as keyof typeof en];
            if (enValue !== undefined) {
                expect(placeholders(enValue), key).toEqual(placeholders(ru[key as keyof typeof ru]));
            }
        }
    });
});
