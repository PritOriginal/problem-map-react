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
} from "ymap3-components";

import customization from './customization.json'

import { AdminBoundary, AdminBoundaryMarksCount } from './services/MapService';
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { LngLat, LngLatBounds, MapEventUpdateHandler, VectorCustomization, YMap as YMapInstance, YMapCenterLocation, YMapLocationRequest, ZoomRange } from "@yandex/ymaps3-types";
import MarkItem, { COLOR_MARK_STATUSES, MarkerItem, MarkerSize, TypeMarkIcons } from "./components/mark/mark";
import { Feature } from "@yandex/ymaps3-clusterer";

import convert from 'color-convert';
import { useLocation, useSearchParams } from "react-router-dom";
import { reaction } from "mobx";
import { filtersEqual, parseFilters, serializeFilters } from "./utils/filters";
import { useNavigateKeepSearch } from "./utils/navigation";
import { Mark, MarkStatusType } from "./services/MarksService";
import selectedPoint from "./store/selected_point";
import selectedMark from "./store/selected_mark";
import { observer } from "mobx-react-lite";
import marksStore from "./store/marks";
import adminBoundariesStore from "./store/admin-boundaries";

import AddIcon from "./assets/plus.svg?react"
import FilterIcon from "./assets/filter.svg?react"
import LocateIcon from "./assets/locate.svg?react"
import markStatusesStore from "./store/mark-statuses";
import markTypesStore from "./store/mark-types";
import panelStore from "./store/panel";
import notificationsStore from "./store/notifications";
import { useDeviceDetect } from "./utils/hooks";

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

  const location = useLocation();
  const navigate = useNavigateKeepSearch();
  const [, setSearchParams] = useSearchParams();
  // the reaction below lives for the whole component lifetime, but setSearchParams (and the `prev`
  // it passes to a functional updater) is rebuilt on every location change — always call the latest one
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;

  const mapRef = useRef<YMapInstance | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const setMapRef = useCallback((instance: YMapInstance | null) => {
    mapRef.current = instance;
    setMapReady(instance !== null);
  }, []);
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

  const onUpdate: MapEventUpdateHandler = useCallback((o) => {
    if (o.location.zoom <= ZOOMS.small) {
      setSize(MarkerSize.small);
    } else if (o.location.zoom <= ZOOMS.big && o.location.zoom >= ZOOMS.small) {
      setSize(MarkerSize.medium);
    } else if (o.location.zoom >= ZOOMS.big) {
      setSize(MarkerSize.big);
    }
    zoomRef.current = o.location.zoom;
    selectedPoint.setCoords(o.location.center);
  }, []);

  const flyTo = useCallback((center: LngLat, minZoom: number) => {
    mapRef.current?.setLocation({
      center,
      zoom: Math.max(zoomRef.current, minZoom),
      duration: 400,
    });
  }, []);

  // filters <-> URL (?types=&statuses=)
  useEffect(() => {
    const fromUrl = parseFilters(window.location.search, marksStore.filters);
    if (!filtersEqual(fromUrl, marksStore.filters)) {
      marksStore.setFilters(fromUrl);
    }
    const dispose = reaction(
      () => serializeFilters(marksStore.filters).toString(),
      () => {
        setSearchParamsRef.current((prev) => serializeFilters(marksStore.filters, prev), { replace: true });
      },
      { fireImmediately: true },
    );
    return dispose;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (pendingCenter && mapReady) {
      flyTo(pendingCenter, ZOOMS.big);
      selectedMark.consumeCenter();
    }
  }, [pendingCenter, mapReady, flyTo]);

  const getUserLocation = useCallback((center: boolean) => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser.');
      if (center) {
        notificationsStore.showError(null, "Геолокация не поддерживается браузером");
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
          notificationsStore.showError(null, "Не удалось определить местоположение");
        }
      },
      { enableHighAccuracy: center, timeout: 10_000 },
    );
  }, [flyTo]);

  const cluster = useCallback((coordinates: LngLat, features: Feature[]) => (
    <YMapMarker coordinates={coordinates}>
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
  const marker = useCallback((feature: Feature) => (
    <MarkItem mark={feature.properties!.mark as Mark} size={size} selected={(feature.properties!.mark as Mark).mark_id === selectedId} onClick={onClickOnMark} />
  ), [size, selectedId, onClickOnMark]);

  const points = useMemo(() => {
    const p: Feature[] = [];
    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i];
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
  }, [marks]);

  return (
    <>
      {showNewMarkButton && isMobile ? <></> : < AddMarkButton />}
      {showNewMarkButton && isMobile && <OpenPanelButton />}
      <Filters />
      <LocateButton onClick={() => getUserLocation(true)} />
      <div className={`map ${panelIsOpen && "panel-open"}`}>
        <YMapComponentsProvider apiKey={YMAPS_API_KEY}>
          <YMap
            ref={setMapRef}
            location={LOCATION}
            restrictMapArea={RESTRICT_AREA}
            zoomRange={ZOOM_RANGE}
            copyrightsPosition={"top right"}
          >
            <YMapDefaultSchemeLayer customization={customization as VectorCustomization} />
            <YMapDefaultFeaturesLayer />
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
            <YMapCustomClusterer marker={marker} cluster={cluster} gridSize={32} features={points!} />
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
      {selectedPoint.visibility ?
        <YMapDefaultMarker
          coordinates={selectedPoint.coords}
          onDragMove={handleDragMoveHandler}
          zIndex={1}
        />
        :
        <></>
      }
    </>
  );
})

const BoundaryItem = memo(function ({ boundary, count }: { boundary: AdminBoundary, count: AdminBoundaryMarksCount }) {
  const color = '#' + getColorPolygon(count);
  return (
    <YMapFeature
      style={{
        stroke: [
          {
            color: "black",
            width: 1,
            opacity: 0.5,
          }
        ],
        fill: color,
        fillOpacity: 0.01 + 0.09 * Math.exp(boundary.admin_level - 10),
      }}
      geometry={boundary.geom}
    />
  );
});


function OpenPanelButton() {
  return (
    <div className="center-button" onClick={() => panelStore.setOpen(true)}>
      Отметить
    </div>
  )
}

function LocateButton({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="circle-button locate-button"
      title="Я здесь"
      role="button"
      tabIndex={0}
      aria-label="Показать моё местоположение"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="circle-button__content">
        <LocateIcon />
      </div>
    </div>
  );
}

function AddMarkButton() {
  const navigate = useNavigateKeepSearch();

  return (
    <div className="circle-button add-mark-button" onClick={() => navigate("/add")}>
      <div className="circle-button__content">
        <AddIcon />
      </div>
    </div>
  );
}

const Filters = observer(() => {
  const [showFilters, setShowFilters] = useState(false);
  return (
    <>
      <div className="circle-button filters-button" onClick={() => setShowFilters(!showFilters)}>
        <div className="circle-button__content">
          <FilterIcon style={{ transform: "translate(0, 2px)" }} />
        </div>
      </div>

      {showFilters &&
        <div className="filters">
          <div className="filters__content">
            <div className="filters__content__title">
              <p>Фильтры проблем</p>
            </div>
            <div className="filters__content__block">
              <p><b>Статусы</b></p>
              {markStatusesStore.statuses.map((status) => (
                <FilterItem
                  icon={
                    <div style={{ height: "12px", width: "12px", border: "1px solid gray", borderRadius: "50%", backgroundColor: COLOR_MARK_STATUSES[status.mark_status_id] }}>
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
              <p><b>Категории</b></p>
              {markTypesStore.types.map((type) => (
                <FilterItem
                  icon={TypeMarkIcons[type.mark_type_id]({ color: "#00" })}
                  name={type.name}
                  checked={marksStore.filters.mark_type_ids.includes(type.mark_type_id)}
                  onClick={() => {
                    marksStore.updateMarkType(type.mark_type_id);
                    adminBoundariesStore.fetchMarksCount();
                  }}
                />
              ))}
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
        onClick={onClick}
      />
      {icon}
      <p>{name}</p>
    </label>
  )
}

export default Map;