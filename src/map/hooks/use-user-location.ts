import { useCallback, useState } from "react";
import type { LngLat } from "@yandex/ymaps3-types";

import { useT } from "../../i18n";
import notificationsStore from "../../store/notifications";
import selectedPoint from "../../store/selected_point";
import { ZOOMS } from "../map-constants";

export type FlyTo = (center: LngLat, minZoom: number) => void;

/**
 * Where the user is, and the control that takes the map there.
 *
 * `locate(false)` is the quiet form used on load: it only places the blue dot, so a
 * denied or failed lookup stays silent and cheap (no high accuracy asked for).
 * `locate(true)` is the button, which centres the map, drags the point being placed
 * along with it, and does report a failure -- someone asked for it and nothing happened.
 */
export function useUserLocation(flyTo: FlyTo): {
    userLocation: GeolocationCoordinates | null;
    locate: (center: boolean) => void;
} {
    const { t } = useT();
    const [userLocation, setUserLocation] = useState<GeolocationCoordinates | null>(null);

    const locate = useCallback((center: boolean) => {
        if (!navigator.geolocation) {
            console.error("Geolocation is not supported by this browser.");
            if (center) {
                notificationsStore.showError(null, t("map.geoUnsupported"));
            }
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserLocation(position.coords);
                if (center) {
                    const coords: LngLat = [position.coords.longitude, position.coords.latitude];
                    flyTo(coords, ZOOMS.big);
                    if (selectedPoint.visibility) {
                        selectedPoint.setCoords(coords);
                    }
                }
            },
            (error) => {
                console.error("Error getting user location:", error);
                if (center) {
                    notificationsStore.showError(null, t("map.geoFailed"));
                }
            },
            { enableHighAccuracy: center, timeout: 10_000 },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flyTo]);

    return { userLocation, locate };
}
