import { describe, expect, it } from "vitest";
import { badgeGlyph, levelProgress, parseLevel, parseProfile } from "./profile";

describe("parseProfile", () => {
    it("normalizes a full wave-5 profile payload", () => {
        const profile = parseProfile({
            user_id: 5,
            username: "ann",
            rating: 120,
            level: { number: 2, name: "Активист", next_threshold: 200 },
            badges: [{ code: "first_mark", name: "Первая метка", description: "d", icon: "🏁", earned_at: "2026-01-01T00:00:00Z" }, { nope: true }],
            stats: { marks_total: 3 },
            member_since: "2025-05-01T00:00:00Z",
        });
        expect(profile.user_id).toBe(5);
        expect(profile.level).toEqual({ number: 2, name: "Активист", next_threshold: 200 });
        expect(profile.badges).toHaveLength(1);
        expect(profile.badges[0].icon).toBe("🏁");
        expect(profile.stats.marks_total).toBe(3);
    });

    it("tolerates missing fields, a bare level number and a wrapped payload", () => {
        const profile = parseProfile({ profile: { user_id: 1, username: "x", rating: 10, level: 3 } });
        expect(profile.level).toEqual({ number: 3, name: "", next_threshold: null });
        expect(profile.badges).toEqual([]);
        expect(profile.stats).toEqual({});
        expect(parseProfile(null).user_id).toBe(0);
        expect(parseLevel({ number: 0 }).number).toBe(1);
    });
});

describe("levelProgress", () => {
    it("computes the share to the next threshold and the remaining rating", () => {
        expect(levelProgress(50, { number: 1, name: "", next_threshold: 100 })).toEqual({ ratio: 0.5, remaining: 50 });
        expect(levelProgress(150, { number: 2, name: "", next_threshold: 200 }, 100)).toEqual({ ratio: 0.5, remaining: 50 });
        expect(levelProgress(250, { number: 2, name: "", next_threshold: 200 })).toEqual({ ratio: 1, remaining: 0 });
    });

    it("is full on the last level", () => {
        expect(levelProgress(999, { number: 9, name: "", next_threshold: null })).toEqual({ ratio: 1, remaining: 0 });
    });
});

describe("badgeGlyph", () => {
    it("keeps emoji and abbreviates icon codes", () => {
        expect(badgeGlyph("🏁", "first")).toBe("🏁");
        expect(badgeGlyph("", "first_mark")).toBe("FI");
        expect(badgeGlyph("star", "x")).toBe("ST");
        expect(badgeGlyph("", "")).toBe("★");
    });
});
