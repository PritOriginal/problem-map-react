import { useCallback } from "react";
import { observer } from "mobx-react-lite";
import { YMapDefaultMarker, YMapFeature } from "ymap3-components";
import type { LngLat } from "@yandex/ymaps3-types";

import selectedPoint from "../../store/selected_point";

/** The draggable point a mark is placed at, and the zone circle drawn around it. */
const SelectedPoint = observer(() => {
    const handleDragMoveHandler = useCallback((coordinates: LngLat) => {
        selectedPoint.setCoords(coordinates);
    }, []);

    return (
        <>
            {selectedPoint.visibility && selectedPoint.visibilityCircle &&
                <YMapFeature
                    source="userPolygonsSource"
                    style={{
                        stroke: [{ color: selectedPoint.color, width: 1, opacity: 0.6 }],
                        fill: selectedPoint.color,
                        fillOpacity: 0.1,
                    }}
                    geometry={selectedPoint.circleGeom}
                />
            }
            {selectedPoint.visibility &&
                <YMapDefaultMarker
                    source="userSource"
                    color={selectedPoint.color}
                    coordinates={selectedPoint.coords}
                    onDragMove={handleDragMoveHandler}
                />
            }
        </>
    );
});

export default SelectedPoint;
