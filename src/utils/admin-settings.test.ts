import { describe, expect, it } from "vitest";
import { EMPTY_SETTINGS, normalizeSettings, setPath, validateSettings } from "./admin-settings";

describe("admin settings validation", () => {
    it("accepts the defaults and rejects out-of-range / non-integer / bad duration values", () => {
        expect(validateSettings(EMPTY_SETTINGS)).toEqual({});
        const bad = normalizeSettings({ vote_threshold: 0, tasker: { target_probability: 1.5, task_ttl: "soon", max_radius_meters: 10.5 } });
        expect(validateSettings(bad)).toMatchObject({
            vote_threshold: "range",
            "tasker.target_probability": "range",
            "tasker.max_radius_meters": "integer",
            "tasker.task_ttl": "duration",
        });
        expect(validateSettings(setPath(EMPTY_SETTINGS, "rating.check_correct", NaN))["rating.check_correct"]).toBe("required");
        expect(validateSettings(setPath(EMPTY_SETTINGS, "tasker.task_ttl", "1h30m"))).toEqual({});
    });

    it("setPath returns a copy", () => {
        const next = setPath(EMPTY_SETTINGS, "rating.check_wrong", -5);
        expect(next.rating.check_wrong).toBe(-5);
        expect(EMPTY_SETTINGS.rating.check_wrong).toBe(0);
    });
});
