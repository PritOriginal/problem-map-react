import {
  YMap,
  YMapDefaultSchemeLayer,
  YMapDefaultFeaturesLayer,
  YMapComponentsProvider,
  YMapFeature,
  YMapListener,
  // ...other components
} from "ymap3-components";

import customization from './customization.json'

import { Geometry } from '@yandex/ymaps3-types/imperative/YMapFeature/types';
import MapService from './services/MapService';
import { useCallback, useEffect, useState } from "react";
import { MapEventUpdateHandler, VectorCustomization, YMapLocationRequest } from "@yandex/ymaps3-types";
import MarkItem, { Mark, MarkerItem, MarkerSize } from "./components/mark/mark";

interface District {
  district_id: number;
  name: string;
  geom: Geometry;
}

const LOCATION: YMapLocationRequest = {
  center: [41.452746, 52.722408],
  zoom: 11
};

export const ZOOMS = {
  small: 12,
  big: 16
};

export default function Map() {
  const [userLocation, setUserLocation] = useState<GeolocationCoordinates | null>(null);
  const [size, setSize] = useState<MarkerSize>(MarkerSize.big);

  const [polygons, setPolygons] = useState<District[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);

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

  return (
    <YMapComponentsProvider apiKey={'fcce59dc-11d5-48d7-8b83-8ade1dba34df'}>
      <YMap location={LOCATION}>
        <YMapDefaultSchemeLayer customization={customization as VectorCustomization} />
        <YMapDefaultFeaturesLayer />
        {polygons.map((polygon) => (
          <PolygonItem key={polygon.district_id} geom={polygon.geom} />
        ))}
        {marks.map((mark) => (
          <MarkItem key={mark.district_id} mark={mark} size={size} />
        ))}
        {userLocation &&
          < MarkerItem
            coordinates={[userLocation?.longitude, userLocation?.latitude]}
            color={"white"}
          />
        }
        <YMapListener onUpdate={onUpdate} />
        {/* <YMapClusterer cluster={cluster} /> */}
      </YMap>
    </YMapComponentsProvider>
  );
}

const colors = [
  "#36FF58",
  "#e1ff36ff",
  "#ffd036ff",
  "#ff4336ff",
]

function getRandomInt(min, max) {  
    min = Math.ceil(min); // округляем до ближайшего большего целого  
    max = Math.floor(max); // округляем до ближайшего меньшего целого  
    return Math.floor(Math.random() * (max - min + 1)) + min; // генерируем случайное целое число  
} 

function PolygonItem({ geom }: { geom: Geometry }) {
  const color = colors[getRandomInt(0, colors.length - 1)]
  return (
    <YMapFeature
      style={{
        stroke: [
          {
            color: color,
            width: 1,
          }
        ],
        fill: color,
        fillOpacity: 0.03,
      }}
      geometry={geom}
    />
  );
}