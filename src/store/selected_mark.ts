import { LngLat } from "@yandex/ymaps3-types";
import { makeAutoObservable } from 'mobx';

class SelectedMark {
    id: number = 0;
    /** Coordinates the map should fly to (set on deep-link open); null when no centering is pending. */
    pendingCenter: LngLat | null = null;
    /** Id of the mark selected by clicking on the map — such a selection must not recenter the map. */
    private clickedId: number = 0;

    constructor() {
        makeAutoObservable(this);
    }

    setId = (id: number) => {
        if (this.id !== id) {
            this.pendingCenter = null;
        }
        this.id = id;
    }

    /** Marks the id as selected by a click on the map marker. */
    selectByClick = (id: number) => {
        this.clickedId = id;
        this.setId(id);
    }

    /** Called when the mark details are loaded: requests centering unless the mark was picked on the map. */
    setLoadedCoords = (id: number, coords: LngLat) => {
        if (this.id !== id) {
            return;
        }
        if (this.clickedId === id) {
            this.clickedId = 0;
            return;
        }
        this.pendingCenter = coords;
    }

    consumeCenter = () => {
        this.pendingCenter = null;
    }
}

const selectedMark = new SelectedMark();

export default selectedMark
