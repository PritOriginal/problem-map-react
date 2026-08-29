import { LngLat, PolygonGeometry } from "@yandex/ymaps3-types";
import { makeAutoObservable } from 'mobx';
import { circle } from "@turf/circle";

/** Radius (km) of the zone drawn around the home point while signing up. */
export const HOME_ZONE_RADIUS_KM = 0.5;

type Mode = "add" | "signup" | "none";

const MODE_COLORS: Record<Mode, string> = {
    add: "red",
    signup: "blue",
    none: "red",
};

/**
 * The draggable point on the map: the new mark position (`/add`, red) or the
 * user's home point with a 500 m zone around it (`/signup`, blue).
 */
class SelectedPoint {
    coords: LngLat = [1, 2];
    /** The point marker is shown. */
    visibility: boolean = false;
    /** The radius circle around the point is shown. */
    visibilityCircle: boolean = false;
    color: string = MODE_COLORS.none;

    constructor() {
        makeAutoObservable(this);
    }

    /** Circle of `HOME_ZONE_RADIUS_KM` around `coords` (GeoJSON polygon). */
    get circleGeom(): PolygonGeometry {
        return circleGeometry(this.coords, HOME_ZONE_RADIUS_KM);
    }

    /**
     * Moves the point. An identical pair is ignored: the map reports a centre on every
     * frame of a pan, and a fresh array of the same two numbers would invalidate
     * `circleGeom` — a 64-vertex turf polygon — for nothing.
     */
    setCoords = (coords: LngLat) => {
        if (this.coords[0] === coords[0] && this.coords[1] === coords[1]) {
            return;
        }
        this.coords = coords;
    }

    showPoint = () => {
        this.visibility = true;
    }

    hidePoint = () => {
        this.visibility = false;
    }

    showCircle = () => {
        this.visibilityCircle = true;
    }

    hideCircle = () => {
        this.visibilityCircle = false;
    }

    hideAll = () => {
        this.visibility = false;
        this.visibilityCircle = false;
    }

    /** `/add`: a red point without a zone. */
    setAddMode = () => {
        this.visibility = true;
        this.visibilityCircle = false;
        this.color = MODE_COLORS.add;
    }

    /** `/signup`: a blue home point with the zone around it. */
    setSignupMode = () => {
        this.visibility = true;
        this.visibilityCircle = true;
        this.color = MODE_COLORS.signup;
    }
}

/** Vertices of the generated ring; turf's own default, pinned so an upstream change cannot reshape the zone. */
export const CIRCLE_STEPS = 64;

export function circleGeometry(center: LngLat, radiusKm: number): PolygonGeometry {
    const { geometry } = circle([center[0], center[1]], radiusKm, { steps: CIRCLE_STEPS, units: "kilometers" });
    return geometry as PolygonGeometry;
}

const selectedPoint = new SelectedPoint();

export default selectedPoint
