import {
    YMap,
    YMapDefaultSchemeLayer,
    YMapDefaultFeaturesLayer,
    YMapComponentsProvider,
    YMapListener,
    YMapMarker,
    YMapCustomClusterer,
    YMapLayer,
    YMapFeatureDataSource,
} from "ymap3-components";

import { type ResolvedTheme, useTheme } from "./theme";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LngLat, MapEventUpdateHandler, VectorCustomization, YMap as YMapInstance } from "@yandex/ymaps3-types";
import type { Feature } from "@yandex/ymaps3-clusterer";
import { observer } from "mobx-react-lite";
import { useLocation } from "react-router-dom";

import MarkItem, { MarkerItem } from "./components/mark/mark";
import { MarkerSize } from "./components/mark/marker-size";
import { useNavigateKeepSearch } from "./utils/navigation";
import { useDeviceDetect } from "./utils/hooks";
import { Mark } from "./services/MarksService";
import selectedPoint from "./store/selected_point";
import selectedMark from "./store/selected_mark";
import marksStore from "./store/marks";
import adminBoundariesStore from "./store/admin-boundaries";
import markStatusesStore from "./store/mark-statuses";
import markTypesStore from "./store/mark-types";
import tasksStore from "./store/tasks";
import heatmapStore from "./store/heatmap";

import {
    INITIAL_CENTER,
    INITIAL_ZOOM,
    LOCATION,
    RESTRICT_AREA,
    roundCoords,
    YMAPS_API_KEY,
    ZOOM_RANGE,
    ZOOMS,
} from "./map/map-constants";
import { getColorByFeatures } from "./map/map-colors";
import { type MarkFeature, markOf, toMarkFeature } from "./map/mark-feature";
import SelectedPoint from "./map/layers/selected-point";
import HeatmapLayer from "./map/layers/heatmap-layer";
import BoundaryItem from "./map/layers/boundary-item";
import HeatmapLegend from "./map/controls/heatmap-legend";
import { AddMarkButton, LocateButton, OpenPanelButton } from "./map/controls/map-buttons";
import Filters from "./map/filters/filters";
import { useUrlFilters } from "./map/hooks/use-url-filters";
import { useMapZoomSize } from "./map/hooks/use-map-zoom-size";
import { useHeatmapView } from "./map/hooks/use-heatmap-view";
import { type FlyTo, useUserLocation } from "./map/hooks/use-user-location";
import { useAsyncData } from "./utils/use-async-data";

/**
 * The two basemap style sheets are 250 kB of JSON between them and exactly one of
 * them is ever used, so they are fetched for the theme in force instead of being
 * built into the entry chunk -- they were, on their own, more than a third of it.
 *
 * The scheme layer stays mounted throughout and simply takes the style when it
 * lands: unmounting it while the JSON is in flight would reorder the map's layers
 * against the sources declared under it. In practice the JSON arrives well before
 * the map does -- the Yandex SDK itself is a network fetch made after this one.
 */
function useMapCustomization(resolvedTheme: ResolvedTheme): VectorCustomization | undefined {
    // `silent`: a basemap in the SDK's default colours is a far better outcome than a
    // banner, so a failed style fetch is logged and left at that. The hook keeps the
    // previous style while the next one is in flight, so switching theme does not
    // flash an unstyled map.
    const { data } = useAsyncData<VectorCustomization>(
        async () => {
            const module = resolvedTheme === "dark"
                ? await import("./customization-dark.json")
                : await import("./customization.json");
            return module.default as VectorCustomization;
        },
        [resolvedTheme],
        { silent: true },
    );

    return data;
}

const Map = observer(() => {
    const { isMobile } = useDeviceDetect();
    // The basemap has to follow the theme too: dark chrome around a bright map
    // reads as a hole punched in the page.
    const { resolved: resolvedTheme } = useTheme();
    const customization = useMapCustomization(resolvedTheme);

    const location = useLocation();
    const navigate = useNavigateKeepSearch();

    const [map, setMap] = useState<YMapInstance | null>(null);
    const zoomRef = useRef<number>(INITIAL_ZOOM);
    /** Latest map centre, tracked without touching the store. */
    const centerRef = useRef<LngLat>(INITIAL_CENTER);

    // Both are the route, read two ways, and the route is already state React owns:
    // mirroring it into two useStates cost a second render on every navigation and could
    // be caught a frame out of step with the panel it describes.
    const panelIsOpen = location.pathname !== "/";
    const showNewMarkButton = location.pathname === "/add";

    const flyTo: FlyTo = useCallback((center, minZoom) => {
        map?.setLocation({
            center,
            zoom: Math.max(zoomRef.current, minZoom),
            duration: 400,
        });
    }, [map]);

    const { userLocation, locate } = useUserLocation(flyTo);
    const { size, setSizeForZoom } = useMapZoomSize();
    const { filtersQuery } = useUrlFilters();
    const { onUpdateView } = useHeatmapView(filtersQuery);

    const boundaries = adminBoundariesStore.boundaries;
    // Detail level follows the marker size (i.e. the zoom): districts only when
    // zoomed out. Memoized so panning, which rerenders the map, does not refilter
    // every polygon.
    const filteredBoundaries = useMemo(() => boundaries.filter((boundary) => {
        if (size === MarkerSize.small) {
            return boundary.admin_level <= 9;
        } else {
            return boundary.admin_level <= 10;
        }
    }), [boundaries, size]);

    const { marks } = marksStore;

    const onClickOnMark = useCallback((mark: Mark) => {
        selectedMark.selectByClick(mark.mark_id);
        navigate(`/problem/${mark.mark_id}`);
    }, [navigate])

    const onUpdate: MapEventUpdateHandler = useCallback((o) => {
        onUpdateView(o.location);
        setSizeForZoom(o.location.zoom);
        zoomRef.current = o.location.zoom;
        centerRef.current = o.location.center;
        // The point follows the map centre only while it is on screen (/add, /signup).
        // Off screen the centre is only remembered, so that showing the point still puts
        // it where the map is looking -- see the effect below.
        if (selectedPoint.visibility) {
            selectedPoint.setCoords(roundCoords(o.location.center));
        }
    }, [onUpdateView, setSizeForZoom]);

    // the point appears at the current centre, however far the map moved while it was hidden
    const pointVisible = selectedPoint.visibility;
    useEffect(() => {
        if (pointVisible) {
            selectedPoint.setCoords(roundCoords(centerRef.current));
        }
    }, [pointVisible]);

    // `locate` is rebuilt whenever the language changes (its failure messages go through
    // `t`), and the load below must not run again for that -- so the effect reaches it
    // through a ref, the way `useAsyncData` holds its fetcher.
    const locateRef = useRef(locate);
    locateRef.current = locate;

    useEffect(() => {
        adminBoundariesStore.fetchBoundaries();
        adminBoundariesStore.fetchMarksCount();
        marksStore.fetch();
        markTypesStore.fetch();
        markStatusesStore.fetch();
        locateRef.current(false);
        selectedPoint.setCoords(INITIAL_CENTER)
    }, []);

    // deep link: /problem/:id opened directly -> center the map on the mark
    const pendingCenter = selectedMark.pendingCenter;
    useEffect(() => {
        if (pendingCenter && map) {
            flyTo(pendingCenter, ZOOMS.big);
            selectedMark.consumeCenter();
        }
    }, [pendingCenter, map, flyTo]);

    const cluster = useCallback((coordinates: LngLat, features: Feature[]) => (
        <YMapMarker source="markerSource" coordinates={coordinates}>
            <div className="circle">
                <div className="circle-content" style={{ backgroundColor: "#" + getColorByFeatures(features) }}>
                    <span className="circle-text">
                        {features.length}
                    </span>
                </div>
            </div>
        </YMapMarker>
    ), []);

    const assignedMarkIds = tasksStore.assignedMarkIds;
    // Selection and assignment are NOT read here: `MarkItem` is an observer and
    // reads them itself, so this callback keeps its identity across a click and
    // the clusterer does not rebuild every marker.
    const typesById = markTypesStore.byId;
    const marker = useCallback((feature: Feature) => {
        const mark = markOf(feature);
        return (
            <MarkItem
                mark={mark}
                type={typesById.get(mark.mark_type_id)}
                size={size}
                onClick={onClickOnMark}
            />
        );
    }, [size, onClickOnMark, typesById]);

    // back online: incremental refresh instead of a full reload (wave-5 `GET /marks/changes`)
    useEffect(() => {
        const onOnline = () => {
            marksStore.sync();
        };
        window.addEventListener("online", onOnline);
        return () => window.removeEventListener("online", onOnline);
    }, []);

    const onlyMine = tasksStore.onlyMine;
    const points = useMemo(() => {
        const p: MarkFeature[] = [];
        for (let i = 0; i < marks.length; i++) {
            const mark = marks[i];
            if (onlyMine && !assignedMarkIds.has(mark.mark_id)) {
                continue;
            }
            p.push(toMarkFeature(mark));
        }
        return p
    }, [marks, onlyMine, assignedMarkIds]);

    const heatmapEnabled = heatmapStore.enabled;

    return (
        <>
            {showNewMarkButton && isMobile ? <></> : < AddMarkButton />}
            {showNewMarkButton && isMobile && <OpenPanelButton />}
            <Filters />
            {heatmapEnabled && <HeatmapLegend />}
            <LocateButton onClick={() => locate(true)} />
            <div className={`map ${panelIsOpen && "panel-open"}`}>
                <YMapComponentsProvider apiKey={YMAPS_API_KEY}>
                    <YMap
                        ref={setMap}
                        location={LOCATION}
                        restrictMapArea={RESTRICT_AREA}
                        zoomRange={ZOOM_RANGE}
                        copyrightsPosition={"top right"}
                        // The SDK styles its own controls, logo and copyright from this. Without
                        // it they stay in light mode: the "Открыть Яндекс Карты" label goes
                        // dark-on-dark and the black wordmark disappears into the basemap.
                        theme={resolvedTheme}
                    >
                        <YMapDefaultSchemeLayer customization={customization} />
                        <YMapDefaultFeaturesLayer />

                        {/* own sources + layers so that boundaries < zones < marks < the draggable point, whatever the mount order */}
                        <YMapFeatureDataSource id="boundariesSource" />
                        <YMapLayer source="boundariesSource" type="features" zIndex={1800} />
                        <YMapFeatureDataSource id="userPolygonsSource" />
                        <YMapLayer source="userPolygonsSource" type="features" zIndex={1900} />
                        <YMapFeatureDataSource id="markerSource" />
                        <YMapLayer source="markerSource" type="markers" zIndex={2000} />
                        <YMapFeatureDataSource id="userSource" />
                        <YMapLayer source="userSource" type="markers" zIndex={2100} />

                        {filteredBoundaries.map((boundary) => (
                            <BoundaryItem
                                key={boundary.id}
                                boundary={boundary}
                                count={adminBoundariesStore.countById.get(boundary.id)}
                            />
                        ))}
                        {userLocation &&
                            < MarkerItem
                                coordinates={[userLocation?.longitude, userLocation?.latitude]}
                                color={"white"}
                            />
                        }
                        <SelectedPoint />
                        <YMapListener onUpdate={onUpdate} />
                        {heatmapEnabled
                            ? <HeatmapLayer />
                            : <YMapCustomClusterer marker={marker} cluster={cluster} gridSize={32} features={points!} />
                        }
                    </YMap>
                </YMapComponentsProvider>
            </div>
        </>
    );
});

export default Map;
