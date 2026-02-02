import { LngLat } from "@yandex/ymaps3-types";
import { makeAutoObservable } from 'mobx';

class SelectedPoint {
    coords: LngLat = [1, 2];
    visibility: boolean = false;

    constructor() {
        makeAutoObservable(this);
    }

    setCoords = (coords: LngLat) => {
        this.coords = coords;
    }

    showPoint = () => {
        this.visibility = true;
    }
    
    hidePoint = () => {
        this.visibility = false;
    }
}

const selectedPoint = new SelectedPoint();

export default selectedPoint