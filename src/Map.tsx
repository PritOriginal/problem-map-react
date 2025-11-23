import {
  YMap,
  YMapDefaultSchemeLayer,
  YMapDefaultFeaturesLayer,
  YMapComponentsProvider,
  YMapFeature,
  YMapListener,
  YMapMarker,
  YMapCustomClusterer,
} from "ymap3-components";

import customization from './customization.json'

import { Geometry } from '@yandex/ymaps3-types/imperative/YMapFeature/types';
import MapService from './services/MapService';
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { LngLat, LngLatBounds, MapEventUpdateHandler, VectorCustomization, YMapLocationRequest, ZoomRange } from "@yandex/ymaps3-types";
import MarkItem, { Mark, MarkerItem, MarkerSize } from "./components/mark/mark";
import { Feature } from "@yandex/ymaps3-clusterer";

import convert from 'color-convert';
import PanelRoute from "./components/panel/panel";
import { useNavigate } from "react-router-dom";
interface District {
  district_id: number;
  name: string;
  geom: Geometry;
}

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

// export const getBooleanPointInPolygon = (polygon: LngLat[][], point: LngLat): boolean => {
//   const pt = turf.point(point);
//   const poly = turf.polygon(polygon);
//   return turf.booleanPointInPolygon(pt, poly);
// };

// function GetPointsInPolygon(polygons: District[], marks: Mark[]) {

//   marks.forEach(mark => {
//     polygons.forEach((polygon, i) => {
//       if (getBooleanPointInPolygon(polygon.geom.coordinates, mark.geom)) {
//         polygon.
//       }
//     });
//   });
// }

export default function Map() {
  let navigate = useNavigate();

  const [userLocation, setUserLocation] = useState<GeolocationCoordinates | null>(null);
  const [size, setSize] = useState<MarkerSize>(MarkerSize.big);

  const [polygons, setPolygons] = useState<District[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);

  const [selectedMark, setSelectedMark] = useState<Mark | null>(null);

  const onClickOnMark = useCallback((mark: Mark) => {
    navigate(`/problem/${mark.mark_id}`)
    setSelectedMark(mark);
  }, [])

  const onUpdate: MapEventUpdateHandler = useCallback((o) => {
    if (o.location.zoom <= ZOOMS.small) {
      setSize(MarkerSize.small);
    } else if (o.location.zoom <= ZOOMS.big && o.location.zoom >= ZOOMS.small) {
      setSize(MarkerSize.medium);
    } else if (o.location.zoom >= ZOOMS.big) {
      setSize(MarkerSize.big);
    }
  }, []);

  useEffect(() => {
    MapService.getDistricts()
      .then((data) => {
        setPolygons(data.payload.districts)
        console.log(data.payload)
      })
      .catch(function (error) {
        console.log(error);
      });
    MapService.getMarks()
      .then((data) => {
        setMarks(data.payload.marks)
        console.log(data.payload)
      })
      .catch(function (error) {
        console.log(error);
      });
    getUserLocation();
  }, [])

  const getUserLocation = () => {
    // if geolocation is supported by the users browser
    if (navigator.geolocation) {
      // get the current users location
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log(latitude, longitude);
          setUserLocation(position.coords);
        },
        // if there was an error getting the users location
        (error) => {
          console.error('Error getting user location:', error);
        }
      );
    }
    // if geolocation is not supported by the users browser
    else {
      console.error('Geolocation is not supported by this browser.');
    }
  };

  const getColorByFeatues = (features: Feature[]) => {
    let numsComplete = 0;
    let numsApproved = 0;
    features.forEach(f => {
      const mark = f.properties!.mark as Mark;
      if (mark.mark_status_id == 3) {
        numsComplete++;
      }
      if (mark.mark_status_id != 1) {
        numsApproved++;
      }
    });

    const h = numsComplete / numsApproved * 120;
    if (numsApproved > 0) {
      return convert.hsv.hex(h, 100, 80)
    } else {
      return "d3d3d3ff"
    }
  }

  const cluster = (coordinates: LngLat, features: Feature[]) => (
    <YMapMarker onClick={() => { }} coordinates={coordinates}>
      <div className="circle">
        <div className="circle-content" style={{ backgroundColor: '#' + getColorByFeatues(features) }}>
          <span className="circle-text">
            {features.length}
          </span>
        </div>
      </div>
    </YMapMarker>
  );

  const marker = (feature: Feature) => (
    <MarkItem mark={feature.properties!.mark as Mark} size={size} selected={(feature.properties!.mark as Mark).mark_id === selectedMark?.mark_id} onClick={onClickOnMark} />
  )

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
      {/* {selectedMark && <PanelRoute />} */}
      <PanelRoute />
      <AddMarkButton />
      <YMapComponentsProvider apiKey={'fcce59dc-11d5-48d7-8b83-8ade1dba34df'}>
        <YMap
          location={LOCATION}
          restrictMapArea={RESTRICT_AREA}
          zoomRange={ZOOM_RANGE}
          copyrightsPosition={"top right"}
        >
          <YMapDefaultSchemeLayer customization={customization as VectorCustomization} />
          <YMapDefaultFeaturesLayer />
          {polygons.map((polygon) => (
            <PolygonItem key={polygon.district_id} geom={polygon.geom} />
          ))}
          {userLocation &&
            < MarkerItem
              coordinates={[userLocation?.longitude, userLocation?.latitude]}
              color={"white"}
            />
          }
          <YMapListener onUpdate={onUpdate} />
          <YMapCustomClusterer marker={marker} cluster={cluster} gridSize={32} features={points!} />
        </YMap>
      </YMapComponentsProvider>
    </>
  );
}

const PolygonItem = memo(function ({ geom }: { geom: Geometry }) {
  const color = "#36FF58";
  return (
    <YMapFeature
      style={{
        stroke: [
          {
            color: "black",
            width: 1,
            opacity: 0.3,
          }
        ],
        fill: color,
        fillOpacity: 0.03,
      }}
      geometry={geom}
    />
  );
});


function AddMarkButton() {
  let navigate = useNavigate();

  return (
    <div className="add-mark-button" onClick={() => navigate("/add")}>
      <div className="add-mark-button__content">
        +
      </div>
    </div>
  );
}