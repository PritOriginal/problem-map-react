import {
  YMap,
  YMapDefaultSchemeLayer,
  YMapDefaultFeaturesLayer,
  YMapComponentsProvider,
  YMapFeature,
  YMapListener,
  YMapMarker,
  YMapCustomClusterer,
  YMapDefaultMarker,
  YMapLayer,
  YMapFeatureDataSource,
} from "ymap3-components";

import customization from './customization.json'
import customizationDark from './customization-dark.json'
import { useTheme } from './theme'

import { AdminBoundary, AdminBoundaryMarksCount } from './services/MapService';
import { type KeyboardEvent, type ReactNode, memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { LngLat, LngLatBounds, MapEventUpdateHandler, VectorCustomization, YMap as YMapInstance, YMapCenterLocation, YMapLocationRequest, ZoomRange } from "@yandex/ymaps3-types";
import MarkItem, { MarkerItem, MarkerSize, TypeIcon } from "./components/mark/mark";
import { ASSIGNED, MARKER_ICON, statusColors, STATUS_FALLBACK, themeColors } from "./styles/tokens";
import { typeColor } from "./utils/mark-types";
import { Feature } from "@yandex/ymaps3-clusterer";

import convert from 'color-convert';
import { useLocation, useSearchParams } from "react-router-dom";
import { filtersEqual, parseFilters, serializeFilters } from "./utils/filters";
import { useNavigateKeepSearch } from "./utils/navigation";
import MarksService, { ExportFormat, Mark, MarkStatusType } from "./services/MarksService";
import { useT } from "./i18n";
import selectedPoint from "./store/selected_point";
import selectedMark from "./store/selected_mark";
import { observer } from "mobx-react-lite";
import marksStore, { DEFAULT_FILTERS } from "./store/marks";
import adminBoundariesStore from "./store/admin-boundaries";

import AddIcon from "./assets/plus.svg?react"
import FilterIcon from "./assets/filter.svg?react"
import LocateIcon from "./assets/locate.svg?react"
import markStatusesStore from "./store/mark-statuses";
import markTypesStore from "./store/mark-types";
import panelStore from "./store/panel";
import tasksStore from "./store/tasks";
import user from "./store/user";
import notificationsStore from "./store/notifications";
import { useDeviceDetect } from "./utils/hooks";
import heatmapStore from "./store/heatmap";
import { bboxFromBounds, cellSizeForZoom, heatColor, heatLegend, HEAT_COLORS } from "./utils/heatmap";
import { BBox, HeatmapFeature } from "./services/MapService";

/** Debounce for heatmap reloads while the map is being moved. */
const HEATMAP_DEBOUNCE_MS = 400;

const YMAPS_API_KEY = import.meta.env.VITE_YMAPS_API_KEY ?? "";

const LOCATION: YMapLocationRequest = {
  center: [41.452746, 52.722408],
  zoom: 11
};

const RESTRICT_AREA: LngLatBounds = [[40.96110892973163, 52.54600597551669], [41.91211295805194, 52.90452560092497]];

export const ZOOM_RANGE: ZoomRange = { min: 11, max: 22 };
export const ZOOMS = {
  small: 12,
  big: 16
};

const getColorByFeatues = (features: Feature[]) => {
  let numsConfirmed = 0;
  let numsUnderReview = 0;
  let numsClosed = 0;
  features.forEach(f => {
    const mark = f.properties!.mark as Mark;
    if (mark.mark_status_id == MarkStatusType.ConfirmedStatus ||
      mark.mark_status_id == MarkStatusType.RediscoveredStatus) {
      numsConfirmed++;
    } else if (mark.mark_status_id == MarkStatusType.UnderReviewStatus) {
      numsUnderReview++;
    } else if (mark.mark_status_id == MarkStatusType.ClosedStatus) {
      numsClosed++;
    }
  });

  const allNums = numsConfirmed + numsUnderReview + numsClosed

  const h = (numsClosed + numsUnderReview / 2) / allNums * 120;
  if (allNums > 0) {
    return convert.hsv.hex(h, 100, 80)
  } else {
    return "d3d3d3"
  }
}

const getColorPolygon = (count: AdminBoundaryMarksCount) => {
  if (!count) {
    return "00cc00"
  }

  const allCount = count.confirmed_count + count.under_review_count + count.closed_count;
  if (allCount > 0) {
    const h = (count.closed_count + count.under_review_count / 2) / allCount * 120;
    return convert.hsv.hex(h, 100, 80)
  } else {
    return "00cc00"
  }
}

const Map = observer(() => {
  const { isMobile } = useDeviceDetect();
  const { t } = useT();
  // The basemap has to follow the theme too: dark chrome around a bright map
  // reads as a hole punched in the page.
  const { resolved: resolvedTheme } = useTheme();

  const location = useLocation();
  const navigate = useNavigateKeepSearch();
  const [searchParams, setSearchParams] = useSearchParams();

  const [map, setMap] = useState<YMapInstance | null>(null);
  const zoomRef = useRef<number>((LOCATION as { zoom: number }).zoom);

  const [panelIsOpen, setPanelIsOpen] = useState(false);
  const [showNewMarkButton, setShowNewMarkButton] = useState(false);
  useEffect(() => {
    setPanelIsOpen(location.pathname !== "/");
    setShowNewMarkButton(location.pathname === "/add")
  }, [location.pathname])

  const [userLocation, setUserLocation] = useState<GeolocationCoordinates | null>(null);
  const [size, setSize] = useState<MarkerSize>(MarkerSize.small);

  const filteredBoundaries = adminBoundariesStore.boundaries.filter((boundary) => {
    if (size === MarkerSize.small) {
      return boundary.admin_level <= 9;
    } else {
      return boundary.admin_level <= 10;
    }
  });

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
    selectedPoint.setCoords(o.location.center);
  }, [scheduleHeatmap]);

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
    selectedPoint.setCoords((LOCATION as YMapCenterLocation).center)
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
        <div className="circle-content" style={{ backgroundColor: '#' + getColorByFeatues(features) }}>
          <span className="circle-text">
            {features.length}
          </span>
        </div>
      </div>
    </YMapMarker>
  ), []);

  const selectedId = selectedMark.id;
  const types = markTypesStore.types;
  const assignedMarkIds = tasksStore.assignedMarkIds;
  const marker = useCallback((feature: Feature) => {
    const mark = feature.properties!.mark as Mark;
    return (
      <MarkItem
        mark={mark}
        type={types.find((x) => x.mark_type_id === mark.mark_type_id)}
        size={size}
        selected={mark.mark_id === selectedId}
        assigned={assignedMarkIds.has(mark.mark_id)}
        onClick={onClickOnMark}
      />
    );
  }, [size, selectedId, onClickOnMark, types, assignedMarkIds]);

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
    const p: Feature[] = [];
    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i];
      if (onlyMine && !assignedMarkIds.has(mark.mark_id)) {
        continue;
      }
      p.push({
        geometry: mark.geom,
        type: "Feature",
        id: String(mark.mark_id),
        properties: {
          mark: mark
        }
      })
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
            <YMapDefaultSchemeLayer customization={(resolvedTheme === "dark" ? customizationDark : customization) as VectorCustomization} />
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
                count={adminBoundariesStore.marksCount.find((count) => count.id === boundary.id)!}
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
})

/** Grid cells of the heatmap, filled by the number of marks in each. */
const HeatmapLayer = observer(() => {
  const { features, maxCount } = heatmapStore;
  return (
    <>
      {features.map((feature, index) => (
        <HeatmapCell key={feature.id ?? index} feature={feature} max={maxCount} />
      ))}
    </>
  );
});

const HeatmapCell = memo(function ({ feature, max }: { feature: HeatmapFeature, max: number }) {
  const { resolved } = useTheme();
  const count = feature.properties?.count ?? 0;
  if (count <= 0) {
    return null;
  }
  return (
    <YMapFeature
      style={{
        stroke: [{ color: themeColors(resolved)["--paper"], width: 0.5, opacity: 0.6 }],
        fill: heatColor(count, max),
        fillOpacity: 0.55,
      }}
      geometry={feature.geometry}
      properties={{ count }}
    />
  );
});

const HeatmapLegend = observer(() => {
  const { t } = useT();
  const { maxCount, isLoading, features } = heatmapStore;
  const steps = heatLegend(maxCount);
  return (
    <div className="heatmap-legend" aria-label={t("map.heatLegendAria")}>
      <p className="heatmap-legend__title">{t("map.heatLegendTitle")}{isLoading && ` · ${t("common.loading")}`}</p>
      {features.length === 0 && !isLoading && <p className="heatmap-legend__empty">{t("map.heatLegendEmpty")}</p>}
      {steps.map((step) => (
        <div key={step.label} className="heatmap-legend__row">
          <i style={{ backgroundColor: step.color }} aria-hidden="true" />
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
});

const BoundaryItem = memo(function ({ boundary, count }: { boundary: AdminBoundary, count: AdminBoundaryMarksCount }) {
  const { resolved } = useTheme();
  const color = '#' + getColorPolygon(count);
  return (
    <YMapFeature
      source="boundariesSource"
      style={{
        stroke: [
          {
            color: themeColors(resolved)["--ink"],
            width: 1,
            opacity: 0.5,
          }
        ],
        fill: color,
        // The same alpha does not read the same on both basemaps. Over the light
        // ground a 10% red wash is a pale pink; over the near-black one it is the
        // only luminance in the frame, and a single district at close zoom turns
        // the whole map brown. Halved on dark to keep the tint at the strength it
        // was designed for.
        fillOpacity: (0.01 + 0.09 * Math.exp(boundary.admin_level - 10)) * (resolved === "dark" ? 0.5 : 1),
      }}
      geometry={boundary.geom}
    />
  );
});


/** Props that make a clickable <div> behave like a button for keyboard and screen-reader users. */
function buttonProps(label: string, onClick: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    onClick,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    },
  };
}

function OpenPanelButton() {
  const { t } = useT();
  return (
    <div className="center-button" {...buttonProps(t("map.addMark"), () => panelStore.setOpen(true))}>
      {t("map.add")}
    </div>
  )
}

function LocateButton({ onClick }: { onClick: () => void }) {
  const { t } = useT();
  return (
    <div className="circle-button locate-button" title={t("map.locate")} {...buttonProps(t("map.locateAria"), onClick)}>
      <div className="circle-button__content">
        <LocateIcon />
      </div>
    </div>
  );
}

function AddMarkButton() {
  const navigate = useNavigateKeepSearch();
  const { t } = useT();

  return (
    <div className="circle-button add-mark-button" title={t("map.addMark")} {...buttonProps(t("map.addMark"), () => navigate("/add"))}>
      <div className="circle-button__content">
        <AddIcon />
      </div>
    </div>
  );
}

/** Download link to `GET /marks/export` for the current filters (a real anchor is not blocked by popup blockers). */
const ExportLink = observer(({ format, children }: { format: ExportFormat; children: ReactNode }) => (
  <a
    className="btn-secondary mini"
    href={MarksService.exportUrl(marksStore.filters, format)}
    download={`marks.${format}`}
    target="_blank"
    rel="noopener"
  >
    {children}
  </a>
));

const Filters = observer(() => {
  const { t } = useT();
  const { resolved } = useTheme();
  const statuses = statusColors(resolved);
  const [showFilters, setShowFilters] = useState(false);
  return (
    <>
      <div className="circle-button filters-button" title={t("map.filters")} {...buttonProps(t("map.filtersTitle"), () => setShowFilters(!showFilters))}>
        <div className="circle-button__content">
          <FilterIcon style={{ transform: "translate(0, 2px)" }} />
        </div>
      </div>

      {showFilters &&
        <div className="filters">
          <div className="filters__content">
            <div className="filters__content__title">
              <p>{t("map.filtersTitle")}</p>
            </div>
            <div className="filters__content__block">
              <FilterItem
                icon={<div style={{ height: "12px", width: "12px", background: `linear-gradient(90deg, ${HEAT_COLORS[0]}, ${HEAT_COLORS[HEAT_COLORS.length - 1]})`, border: "1px solid gray" }}></div>}
                name={t("map.heatmap")}
                checked={heatmapStore.enabled}
                onClick={() => heatmapStore.toggle()}
              />
            </div>
            {user.id !== 0 &&
              <div className="filters__content__block">
                <FilterItem
                  icon={<div style={{ height: "12px", width: "12px", borderRadius: "50%", backgroundColor: STATUS_FALLBACK, border: "1px solid gray", outline: `2px dashed ${ASSIGNED}`, outlineOffset: "1px" }}></div>}
                  name={t("map.myTasks")}
                  checked={tasksStore.onlyMine}
                  onClick={() => tasksStore.toggleOnlyMine()}
                />
              </div>
            }
            <div className="filters__content__block">
              <p><b>{t("map.statuses")}</b></p>
              {markStatusesStore.statuses.map((status) => (
                <FilterItem
                  key={status.mark_status_id}
                  icon={
                    <div style={{ height: "12px", width: "12px", border: "1px solid gray", borderRadius: "50%", backgroundColor: statuses[status.mark_status_id] }}>
                    </div>
                  }
                  name={status.name}
                  checked={marksStore.filters.mark_status_ids.includes(status.mark_status_id)}
                  onClick={() => {
                    marksStore.updateMarkStatus(status.mark_status_id);
                  }}
                />
              ))}
            </div>
            <div className="filters__content__block">
              <p><b>{t("map.categories")}</b></p>
              {markTypesStore.types.map((type) => (
                <FilterItem
                  key={type.mark_type_id}
                  icon={<span className={typeColor(type) ? "icon-on-fill" : undefined} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", backgroundColor: typeColor(type) ?? "transparent" }}><TypeIcon typeId={type.mark_type_id} type={type} color={typeColor(type) ? MARKER_ICON : "var(--ink)"} /></span>}
                  name={type.name}
                  checked={marksStore.filters.mark_type_ids.includes(type.mark_type_id)}
                  onClick={() => {
                    marksStore.updateMarkType(type.mark_type_id);
                    adminBoundariesStore.fetchMarksCount();
                  }}
                />
              ))}
            </div>
            <div className="filters__content__block export-row" title={t("map.exportHint")}>
              <p><b>{t("map.export")}</b></p>
              <ExportLink format="geojson">{t("map.exportGeojson")}</ExportLink>
              <ExportLink format="csv">{t("map.exportCsv")}</ExportLink>
            </div>
          </div>
        </div>
      }
    </>
  )
});

function FilterItem({ icon, name, checked, onClick }: { icon: JSX.Element, name: string, checked: boolean, onClick: () => void }) {
  const id = useId();
  return (
    <label className="filters__content__block__item" htmlFor={id}>
      <input
        type="checkbox"
        name=""
        id={id}
        checked={checked}
        onChange={onClick}
      />
      {icon}
      <p>{name}</p>
    </label>
  )
}

export default Map;