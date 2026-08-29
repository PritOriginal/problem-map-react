import { describe, expect, it } from "vitest";
import { toApiPoint } from "./MarksService";

describe("toApiPoint", () => {
    it("sends ymaps3 LngLat cross-wise to match the backend's Coord{Latitude, Longitude} order", () => {
        // [lng, lat] as ymaps3 gives it; the backend puts the `latitude` field into X (=lng)
        expect(toApiPoint([37.6, 55.7])).toEqual({ latitude: 37.6, longitude: 55.7 });
    });
});
