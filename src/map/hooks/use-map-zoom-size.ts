import { useCallback, useState } from "react";

import { MarkerSize } from "../../components/mark/mark";
import { ZOOMS } from "../map-constants";

/**
 * How large a mark's pin is drawn at a given zoom. Three steps rather than a scale:
 * a pin has to stay legible, and at city zoom hundreds of them are on screen at once.
 */
export function markerSizeForZoom(zoom: number): MarkerSize {
    if (zoom <= ZOOMS.small) {
        return MarkerSize.small;
    }
    if (zoom <= ZOOMS.big) {
        return MarkerSize.medium;
    }
    return MarkerSize.big;
}

/**
 * The current marker size, updated from the map's own zoom.
 *
 * The size is state, not a ref: it is read while rendering the markers, and it also
 * decides how detailed the boundary layer is. Setting it to the value it already has
 * is free -- React bails out -- so it can be called on every map update.
 */
export function useMapZoomSize(): { size: MarkerSize; setSizeForZoom: (zoom: number) => void } {
    const [size, setSize] = useState<MarkerSize>(MarkerSize.small);
    const setSizeForZoom = useCallback((zoom: number) => setSize(markerSizeForZoom(zoom)), []);
    return { size, setSizeForZoom };
}
