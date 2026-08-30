import { describe, expect, it } from "vitest";
import { mapWithLimit } from "./concurrency";

describe("mapWithLimit", () => {
    it("keeps order, settles failures and never exceeds the limit", async () => {
        let inFlight = 0;
        let peak = 0;
        const results = await mapWithLimit([1, 2, 3, 4, 5], 2, async (n) => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await new Promise((r) => setTimeout(r, 1));
            inFlight--;
            if (n === 3) {
                throw new Error("boom");
            }
            return n * 10;
        });
        expect(peak).toBe(2);
        expect(results.map((r) => (r.status === "fulfilled" ? r.value : "err"))).toEqual([10, 20, "err", 40, 50]);
    });

    it("handles an empty list", async () => {
        expect(await mapWithLimit([], 3, async (x: number) => x)).toEqual([]);
    });
});
