import { LngLat, PolygonGeometry } from "@yandex/ymaps3-types";
import { makeAutoObservable } from 'mobx';
import * as turf from '@turf/turf';

class SelectedPoint {
    coords: LngLat = [1, 2];
    circleGeom: PolygonGeometry = getCircleGeoJSON(this.coords, 0.5);
    visibilityPoint: boolean = false;
    visibilityCircle: boolean = false;
    color: string = "red";

    constructor() {
        makeAutoObservable(this);
    }

    setCoords = (coords: LngLat) => {
        this.moveCircle(this.coords, coords);
        // console.log("circle", this.circleGeom.coordinates.toString());
        this.coords = coords;
        // this.circleGeom = getCircleGeoJSON(this.coords, 0.5);
    }

    initCircle = () => {
        console.log("init");
        this.circleGeom = getCircleGeoJSON(this.coords, 0.5);
    }

    showPoint = () => {
        this.visibilityPoint = true;
    }

    hidePoint = () => {
        this.visibilityPoint = false;
    }

    showCircle = () => {
        this.visibilityCircle = true;
    }

    hideCircle = () => {
        this.visibilityCircle = false;
    }

    hideAll = () => {
        this.visibilityPoint = false;
        this.visibilityCircle = false;
    }

    setAddMode = () => {
        selectedPoint.showPoint();
        selectedPoint.hideCircle();
        this.color = "red";
    }

    setSignupMode = () => {
        selectedPoint.showPoint();
        selectedPoint.showCircle()
        this.color = "blue";
    }

    moveCircle = (oldCenter: LngLat, newCenter: LngLat) => {
        const dist = turf.distance(oldCenter as number[], newCenter as number[], { units: "kilometers" });
        // console.log("dist", dist);
        const bear = turf.bearing(oldCenter as number[], newCenter as number[]);
        this.circleGeom = turf.transformTranslate(this.circleGeom, dist, bear, { units: "kilometers", mutate: true });
        // return turf.transformTranslate(this.circleGeom, dist, bear, { units: "kilometers" });
    }
}

const getCircleGeoJSON = (center: LngLat, radiusKilometers: number): PolygonGeometry => {
    const { geometry } = turf.circle(center as number[], radiusKilometers, { units: 'kilometers' });
    //   turf.transformTranslate();
    return geometry as PolygonGeometry;
};

const selectedPoint = new SelectedPoint();

export default selectedPoint