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

import { type ResolvedTheme, useTheme } from './theme'

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LngLat, MapEventUpdateHandler, VectorCustomization, YMap as YMapInstance } from "@yandex/ymaps3-types";
import MarkItem, { MarkerItem, MarkerSize } from "./components/mark/mark";

import { useLocation, useSearchParams } from "react-router-dom";
import { filtersEqual, parseFilters, serializeFilters } from "./utils/filters";
import { useNavigateKeepSearch } from "./utils/navigation";
import { Mark } from "./services/MarksService";
import { useT } from "./i18n";
import selectedPoint from "./store/selected_point";
import selectedMark from "./store/selected_mark";
import { observer } from "mobx-react-lite";
import marksStore, { DEFAULT_FILTERS } from "./store/marks";
import adminBoundariesStore from "./store/admin-boundaries";

import markStatusesStore from "./store/mark-statuses";
import markTypesStore from "./store/mark-types";
import tasksStore from "./store/tasks";
import notificationsStore from "./store/notifications";
import { useDeviceDetect } from "./utils/hooks";
import heatmapStore from "./store/heatmap";
import { bboxFromBounds, cellSizeForZoom } from "./utils/heatmap";
import { BBox } from "./services/MapService";
import type { Feature } from "@yandex/ymaps3-clusterer";
import {
  HEATMAP_DEBOUNCE_MS,
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
  const [customization, setCustomization] = useState<VectorCustomization>();

  useEffect(() => {
    let ignore = false;
    const loading = resolvedTheme === "dark"
      ? import('./customization-dark.json')
      : import('./customization.json');
    loading
      .then((module) => {
        if (!ignore) {
          setCustomization(module.default as VectorCustomization);
        }
      })
      // A basemap in the SDK's default colours is a far better outcome than a
      // crash, so a failed style fetch is logged and left at that.
      .catch((error) => console.error(error));
    return () => {
      ignore = true;
    };
  }, [resolvedTheme]);

  return customization;
}

const Map = observer(() => {
  const { isMobile } = useDeviceDetect();
  const { t } = useT();
  // The basemap has to follow the theme too: dark chrome around a bright map
  // reads as a hole punched in the page.
  const { resolved: resolvedTheme } = useTheme();
  const customization = useMapCustomization(resolvedTheme);

  const location = useLocation();
  const navigate = useNavigateKeepSearch();
  const [searchParams, setSearchParams] = useSearchParams();

  const [map, setMap] = useState<YMapInstance | null>(null);
  const zoomRef = useRef<number>(INITIAL_ZOOM);
  /** Latest map centre, tracked without touching the store. */
  const centerRef = useRef<LngLat>(INITIAL_CENTER);

  const [panelIsOpen, setPanelIsOpen] = useState(false);
  const [showNewMarkButton, setShowNewMarkButton] = useState(false);
  useEffect(() => {
    setPanelIsOpen(location.pathname !== "/");
    setShowNewMarkButton(location.pathname === "/add")
  }, [location.pathname])

  const [userLocation, setUserLocation] = useState<GeolocationCoordinates | null>(null);
  const [size, setSize] = useState<MarkerSize>(MarkerSize.small);

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

  // heatmap: current view (bbox + cell size) and a debounced reload on every move
  const viewRef = useRef<{ bbox: BBox; cellM: number } | null>(null);
  const heatmapTimer = useRef<number | undefined>(undefined);
  const scheduleHeatmap = useCallback((immediate: boolean = false) => {
    window.clearTimeout(heatmapTimer.current);
    const run = () => {
      const view = viewRef.current;
      if (view && heatmapStore.enabled) {
        heatmapStore.fetch(view.bbox, view.cellM);
      }
    };
    if (immediate) {
      run();
    } else {
      heatmapTimer.current = window.setTimeout(run, HEATMAP_DEBOUNCE_MS);
    }
  }, []);
  useEffect(() => () => window.clearTimeout(heatmapTimer.current), []);

  const onUpdate: MapEventUpdateHandler = useCallback((o) => {
    if (o.location.bounds) {
      viewRef.current = { bbox: bboxFromBounds(o.location.bounds), cellM: cellSizeForZoom(o.location.zoom) };
      scheduleHeatmap();
    }
    if (o.location.zoom <= ZOOMS.small) {
      setSize(MarkerSize.small);
    } else if (o.location.zoom <= ZOOMS.big && o.location.zoom >= ZOOMS.small) {
      setSize(MarkerSize.medium);
    } else if (o.location.zoom >= ZOOMS.big) {
      setSize(MarkerSize.big);
    }
    zoomRef.current = o.location.zoom;
    centerRef.current = o.location.center;
    // The point follows the map centre only while it is on screen (/add, /signup).
    // Off screen the centre is only remembered, so that showing the point still puts
    // it where the map is looking -- see the effect below.
    if (selectedPoint.visibility) {
      selectedPoint.setCoords(roundCoords(o.location.center));
    }
  }, [scheduleHeatmap]);

  // the point appears at the current centre, however far the map moved while it was hidden
  const pointVisible = selectedPoint.visibility;
  useEffect(() => {
    if (pointVisible) {
      selectedPoint.setCoords(roundCoords(centerRef.current));
    }
  }, [pointVisible]);

  const flyTo = useCallback((center: LngLat, minZoom: number) => {
    map?.setLocation({
      center,
      zoom: Math.max(zoomRef.current, minZoom),
      duration: 400,
    });
  }, [map]);

  // filters <-> URL (?types=&statuses=): URL wins on mount, afterwards the store is written back to the URL
  useEffect(() => {
    const fromUrl = parseFilters(searchParams, DEFAULT_FILTERS);
    if (!filtersEqual(fromUrl, marksStore.filters)) {
      marksStore.setFilters(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const filtersQuery = serializeFilters(marksStore.filters, DEFAULT_FILTERS).toString();
  useEffect(() => {
    setSearchParams((prev) => serializeFilters(marksStore.filters, DEFAULT_FILTERS, prev), { replace: true });
  }, [filtersQuery, setSearchParams]);

  // heatmap: reload when toggled on or when the mark filters change
  const heatmapEnabled = heatmapStore.enabled;
  useEffect(() => {
    if (heatmapEnabled) {
      scheduleHeatmap(true);
    }
  }, [heatmapEnabled, filtersQuery, scheduleHeatmap]);

  useEffect(() => {
    adminBoundariesStore.fetchBoundaries();
    adminBoundariesStore.fetchMarksCount();
    marksStore.fetch();
    markTypesStore.fetch();
    markStatusesStore.fetch();
    getUserLocation(false);
    selectedPoint.setCoords(INITIAL_CENTER)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // deep link: /problem/:id opened directly -> center the map on the mark
  const pendingCenter = selectedMark.pendingCenter;
  useEffect(() => {
    if (pendingCenter && map) {
      flyTo(pendingCenter, ZOOMS.big);
      selectedMark.consumeCenter();
    }
  }, [pendingCenter, map, flyTo]);

  const getUserLocation = useCallback((center: boolean) => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser.');
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
        console.error('Error getting user location:', error);
        if (center) {
          notificationsStore.showError(null, t("map.geoFailed"));
        }
      },
      { enableHighAccuracy: center, timeout: 10_000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo]);

  const cluster = useCallback((coordinates: LngLat, features: Feature[]) => (
    <YMapMarker source="markerSource" coordinates={coordinates}>
      <div className="circle">
        <div className="circle-content" style={{ backgroundColor: '#' + getColorByFeatures(features) }}>
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

  return (
    <>
      {showNewMarkButton && isMobile ? <></> : < AddMarkButton />}
      {showNewMarkButton && isMobile && <OpenPanelButton />}
      <Filters />
      {heatmapEnabled && <HeatmapLegend />}
      <LocateButton onClick={() => getUserLocation(true)} />
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