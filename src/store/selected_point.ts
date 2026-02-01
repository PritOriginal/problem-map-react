import { LngLat } from "@yandex/ymaps3-types";
import { makeAutoObservable } from 'mobx';

class SelectedPoint {
    coords: LngLat = [1, 2];

    constructor() {
        makeAutoObservable(this);
    }

    setCoords = (coords: LngLat) => {
        this.coords = coords;
    }
}

const selectedPoint = new SelectedPoint();

export default selectedPoint