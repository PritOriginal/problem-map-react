import { reaction } from "mobx";
import { describe, expect, it } from "vitest";

import selectedPoint, { CIRCLE_STEPS, circleGeometry, HOME_ZONE_RADIUS_KM } from "./selected_point";

/**
 * The zone drawn around the home point used to come from the `@turf/turf` barrel; it now
 * comes from `@turf/circle`. The numbers below were captured from the barrel build and are
 * asserted verbatim, so a change of `steps`, of `units`, or of the upstream implementation
 * shows up as a failing test rather than as a silently different circle on the map.
 */
const CENTER: [number, number] = [37.6, 55.75];
const FIRST_VERTEX: [number, number] = [37.6, 55.75449660181863];
/** Half a turn around the ring: due south of the centre. */
const OPPOSITE_VERTEX: [number, number] = [37.6, 55.745503398181384];

describe("circleGeometry", () => {
    it("draws a closed 64-step ring", () => {
        const geometry = circleGeometry(CENTER, HOME_ZONE_RADIUS_KM);

        expect(geometry.type).toBe("Polygon");
        expect(geometry.coordinates).toHaveLength(1);

        const ring = geometry.coordinates[0];
        expect(CIRCLE_STEPS).toBe(64);
        // steps vertices plus the repeated closing one.
        expect(ring).toHaveLength(CIRCLE_STEPS + 1);
        expect(ring[0]).toEqual(ring[ring.length - 1]);
    });

    it("keeps the exact vertex coordinates of the previous implementation", () => {
        const ring = circleGeometry(CENTER, HOME_ZONE_RADIUS_KM).coordinates[0];

        expect(ring[0][0]).toBeCloseTo(FIRST_VERTEX[0], 12);
        expect(ring[0][1]).toBeCloseTo(FIRST_VERTEX[1], 12);
        expect(ring[ring.length - 1][0]).toBeCloseTo(FIRST_VERTEX[0], 12);
        expect(ring[ring.length - 1][1]).toBeCloseTo(FIRST_VERTEX[1], 12);
        expect(ring[CIRCLE_STEPS / 2][0]).toBeCloseTo(OPPOSITE_VERTEX[0], 12);
        expect(ring[CIRCLE_STEPS / 2][1]).toBeCloseTo(OPPOSITE_VERTEX[1], 12);
    });

    it("reads kilometres, not the turf default of degrees", () => {
        // 0.5 km at this latitude is ~0.0045 degrees; a degrees-based radius would be 0.5.
        const ring = circleGeometry(CENTER, HOME_ZONE_RADIUS_KM).coordinates[0];
        expect(ring[0][1] - CENTER[1]).toBeCloseTo(0.0044966, 6);
    });
});

describe("selectedPoint.circleGeom", () => {
    it("is the zone around the current coords", () => {
        selectedPoint.setCoords(CENTER);
        expect(selectedPoint.circleGeom).toEqual(circleGeometry(CENTER, HOME_ZONE_RADIUS_KM));
        selectedPoint.setCoords([1, 2]);
    });

    it("is not invalidated when the same position is written again", () => {
        selectedPoint.setCoords(CENTER);
        const coords = selectedPoint.coords;
        let rebuilds = 0;
        const dispose = reaction(() => selectedPoint.circleGeom, () => { rebuilds++; });

        // a fresh array of the same numbers, as the map sends on every frame of a pan
        selectedPoint.setCoords([...CENTER]);
        expect(selectedPoint.coords).toBe(coords);
        expect(rebuilds).toBe(0);

        selectedPoint.setCoords([1, 2]);
        expect(rebuilds).toBe(1);
        dispose();
    });
});
