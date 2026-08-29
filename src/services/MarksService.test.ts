import { describe, expect, it } from "vitest";
import { toApiPoint } from "./MarksService";

describe("toApiPoint", () => {
    it("sends ymaps3 LngLat in natural order (requires backend fix/coords-lonlat)", () => {
        // [lng, lat] as ymaps3 gives it -> longitude = coords[0], latitude = coords[1]
        expect(toApiPoint([37.6, 55.7])).toEqual({ longitude: 37.6, latitude: 55.7 });
    });
});
