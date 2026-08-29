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
import { type CSSProperties, type KeyboardEvent, type ReactNode, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LngLat, LngLatBounds, MapEventUpdateHandler, VectorCustomization, YMap as YMapInstance, YMapCenterLocation, YMapLocationRequest, ZoomRange } from "@yandex/ymaps3-types";
import MarkItem, { MarkerItem, MarkerSize, TypeIcon } from "./components/mark/mark";
import { MARKER_ICON, statusColors, STATUS_FALLBACK, themeColors } from "./styles/tokens";
import { typeColor } from "./utils/mark-types";
import { Feature } from "@yandex/ymaps3-clusterer";

import convert from 'color-convert';
import { useLocation, useSearchParams } from "react-router-dom";
import { filtersEqual, parseFilters, serializeFilters } from "./utils/filters";
import { useNavigateKeepSearch } from "./utils/navigation";
import MarksService, { ExportFormat, Mark, MarkStatusType } from "./services/MarksService";
import "./components/filters/filters.scss";
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

// Lengths of the filter panel's morph, kept in step with `filters.scss`. The
// panel is clipped back to the round button's own circle, so for the morph to
// read as one object the button has to stay on screen for part of it.
const FILTERS_OPEN_MS = 220;
const FILTERS_CLOSE_MS = 180;
/** Diameter of the round button, and so of the circle the panel grows out of. */
export const FILTERS_BUTTON_SIZE = 56;

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

/**
 * Map centres arrive with full float precision and jitter in the last bits while the
 * map settles. Five decimals is ~1 m — finer than the point can be placed by hand —
 * and it lets `setCoords` recognise an unchanged position instead of invalidating the
 * zone polygon on every frame. Cheaper than a throttle, and with no lag.
 */
const COORD_PRECISION = 1e5;
const roundCoords = (coords: LngLat): LngLat =>
  [Math.round(coords[0] * COORD_PRECISION) / COORD_PRECISION, Math.round(coords[1] * COORD_PRECISION) / COORD_PRECISION];

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

const getColorPolygon = (count: AdminBoundaryMarksCount | undefined) => {
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
  /** Latest map centre, tracked without touching the store. */
  const centerRef = useRef<LngLat>((LOCATION as YMapCenterLocation).center);

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

  const assignedMarkIds = tasksStore.assignedMarkIds;
  // Selection and assignment are NOT read here: `MarkItem` is an observer and
  // reads them itself, so this callback keeps its identity across a click and
  // the clusterer does not rebuild every marker.
  const typesById = markTypesStore.byId;
  const marker = useCallback((feature: Feature) => {
    const mark = feature.properties!.mark as Mark;
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
  const { visibleFeatures, maxCount } = heatmapStore;
  return (
    <>
      {visibleFeatures.map((feature, index) => (
        <HeatmapCell key={feature.id ?? index} feature={feature} max={maxCount} />
      ))}
    </>
  );
});

const HeatmapCell = memo(function ({ feature, max }: { feature: HeatmapFeature, max: number }) {
  const { resolved } = useTheme();
  // empty cells are filtered out in the store, before the element is built
  const count = feature.properties?.count ?? 0;
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

const BoundaryItem = memo(function ({ boundary, count }: { boundary: AdminBoundary, count: AdminBoundaryMarksCount | undefined }) {
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

/**
 * The map filter panel.
 *
 * Two lists, two controls, because the two lists come from different places.
 * Mark statuses are a fixed dictionary of eight short names -- toggle chips, lit
 * in their own status colour, so the panel doubles as the map's legend. Category
 * names arrive from the backend at a length we do not control, so they stay rows
 * that may wrap. Above both sit the two display MODES, which repaint the whole
 * map rather than narrow the selection and no longer share a list with the filters.
 *
 * An empty list means "no restriction" to the API (`MarksService.marksQuery`
 * omits the param), so a zero count is spelled out as "all" -- a bare 0 reads as
 * "nothing shown", which is its opposite.
 */
const Filters = observer(() => {
  const { t } = useT();
  const { resolved } = useTheme();
  const statuses = statusColors(resolved);
  const [showFilters, setShowFilters] = useState(false);
  // The panel does not appear beside the round button, it IS the button: it is
  // clipped back to a 56px circle at the button's exact position and unclipped
  // outward. The button stays mounted across the morph and crossfades, so the
  // white disc and the dark bar occupy the same circle at the same moment rather
  // than one blinking out and the other in.
  //
  // Both phases are driven by timers rather than by `animationend`: that event is
  // not guaranteed to arrive -- it never fires under reduced motion, and a
  // headless Chrome dropped it even at full duration -- and its failure mode here
  // would be a panel that can never be closed again. A timer always fires.
  const [phase, setPhase] = useState<"open" | "close" | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const open = () => {
    window.clearTimeout(timer.current);
    setShowFilters(true);
    if (reducedMotion()) {
      setPhase(null);
      return;
    }
    setPhase("open");
    timer.current = window.setTimeout(() => setPhase(null), FILTERS_OPEN_MS);
  };

  const close = () => {
    window.clearTimeout(timer.current);
    if (reducedMotion()) {
      setPhase(null);
      setShowFilters(false);
      return;
    }
    setPhase("close");
    timer.current = window.setTimeout(() => {
      setPhase(null);
      setShowFilters(false);
    }, FILTERS_CLOSE_MS);
  };

  const statusIds = marksStore.filters.mark_status_ids;
  const typeIds = marksStore.filters.mark_type_ids;
  const selected = statusIds.length + typeIds.length;
  const total = markStatusesStore.statuses.length + markTypesStore.types.length;
  const isDefault = filtersEqual(marksStore.filters, DEFAULT_FILTERS);

  const count = (selected: number, total: number) =>
    selected === 0 ? t("map.filtersAll") : t("map.filtersCount", { n: selected, total });

  return (
    <>
      {(!showFilters || phase !== null) &&
        <div
          className={`circle-button filters-button${phase ? ` filters-button--${phase}` : ""}`}
          title={t("map.filters")}
          {...buttonProps(t("map.filtersTitle"), open)}
        >
          <div className="circle-button__content">
            <FilterIcon style={{ transform: "translate(0, 2px)" }} />
          </div>
        </div>
      }

      {showFilters &&
        <div className={`filters${phase ? ` filters--${phase}` : ""}`}>
          <div className="filters__bar">
            {/* The round button does not sit beside the panel, it becomes it: the
                panel opens at the button's own position and the glyph moves into
                the bar, where it closes the panel again. */}
            <button
              type="button"
              className="filters__toggle"
              aria-expanded={showFilters}
              aria-label={t("map.filtersTitle")}
              onClick={close}
            >
              <FilterIcon />
            </button>
            <h2>{t("map.filters")}</h2>
            <span className="filters__count">{count(selected, total)}</span>
            {!isDefault &&
              <button type="button" className="filters__reset" onClick={() => marksStore.setFilters(DEFAULT_FILTERS)}>
                {t("map.filtersReset")}
              </button>
            }
          </div>

          <div className="filters__body">
            <div>
              <FilterMode
                swatch={<i className="filter-mode__swatch" style={{ background: `linear-gradient(90deg, ${HEAT_COLORS[0]}, ${HEAT_COLORS[HEAT_COLORS.length - 1]})` }} />}
                name={t("map.heatmap")}
                checked={heatmapStore.enabled}
                onClick={() => heatmapStore.toggle()}
              />
              {user.id !== 0 &&
                <FilterMode
                  swatch={<i className="filter-mode__swatch filter-mode__swatch--mine" />}
                  name={t("map.myTasks")}
                  checked={tasksStore.onlyMine}
                  onClick={() => tasksStore.toggleOnlyMine()}
                />
              }
            </div>

            <section className="filters__group">
              <h3>{t("map.statuses")}<em className="filters__group-count">{count(statusIds.length, markStatusesStore.statuses.length)}</em></h3>
              <div className="filter-chips">
                {markStatusesStore.statuses.map((status) => (
                  <button
                    key={status.mark_status_id}
                    type="button"
                    className="filter-chip"
                    aria-pressed={statusIds.includes(status.mark_status_id)}
                    style={{ "--chip-color": statuses[status.mark_status_id] ?? STATUS_FALLBACK } as CSSProperties}
                    onClick={() => marksStore.updateMarkStatus(status.mark_status_id)}
                  >
                    <i className="filter-chip__dot" />
                    {status.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="filters__group">
              <h3>{t("map.categories")}<em className="filters__group-count">{count(typeIds.length, markTypesStore.types.length)}</em></h3>
              <div className="filter-rows">
                {markTypesStore.types.map((type) => (
                  <button
                    key={type.mark_type_id}
                    type="button"
                    className="filter-row"
                    aria-pressed={typeIds.includes(type.mark_type_id)}
                    onClick={() => {
                      marksStore.updateMarkType(type.mark_type_id);
                      adminBoundariesStore.fetchMarksCount();
                    }}
                  >
                    <span
                      className={`filter-row__glyph${typeColor(type) ? " icon-on-fill" : ""}`}
                      style={typeColor(type) ? { backgroundColor: typeColor(type) } : undefined}
                    >
                      <TypeIcon typeId={type.mark_type_id} type={type} color={typeColor(type) ? MARKER_ICON : "var(--ink)"} />
                    </span>
                    <span className="filter-row__name">{type.name}</span>
                    <i className="filter-row__tick" />
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="filters__foot" title={t("map.exportHint")}>
            <span>{t("map.export")}</span>
            <ExportLink format="geojson">{t("map.exportGeojson")}</ExportLink>
            <ExportLink format="csv">{t("map.exportCsv")}</ExportLink>
          </div>
        </div>
      }
    </>
  )
});

/** A display mode: it repaints the whole map, so it is a switch, not a checkbox. */
function FilterMode({ swatch, name, checked, onClick }: { swatch: ReactNode, name: string, checked: boolean, onClick: () => void }) {
  return (
    <button type="button" className="filter-mode" aria-pressed={checked} onClick={onClick}>
      <span className="filter-mode__switch" />
      {swatch}
      <span className="filter-mode__name">{name}</span>
    </button>
  );
}

export default Map;