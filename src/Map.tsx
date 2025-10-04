import {
  YMap,
  YMapDefaultSchemeLayer,
  YMapDefaultFeaturesLayer,
  YMapComponentsProvider,
  YMapFeature,
  YMapDefaultMarker
  // ...other components
} from "ymap3-components";

import customization from './customization.json'

import { Geometry } from '@yandex/ymaps3-types/imperative/YMapFeature/types';
import MapService from './services/MapService';
import { useEffect, useState } from "react";
import { PointGeometry, VectorCustomization, YMapLocationRequest } from "@yandex/ymaps3-types";

interface District {
  district_id: number;
  name: string;
  geom: Geometry;
}

interface Mark {
  mark_id: number;
  name: string;
  geom: PointGeometry,
  type_mark_id: number;
  user_id: number;
  district_id: number;
  number_votes: number;
  number_checks: number;
}


const LOCATION: YMapLocationRequest = {
  center: [41.452746, 52.722408],
  zoom: 11
};

const COLOR_TYPES_MARK = {
  1: "green",
  2: "red",
} as {
  [index: number]: string
}


export default function Map() {
  const [userLocation, setUserLocation] = useState<GeolocationCoordinates | null>(null);
  const [polygons, setPolygons] = useState<District[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);

  useEffect(() => {
    MapService.getDistricts()
      .then((data) => {
        setPolygons(data.payload)
        console.log(data.payload)
      })
      .catch(function (error) {
        console.log(error);
      });
    MapService.getMarks()
      .then((data) => {
        setMarks(data.payload)
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

        {/* <YMapMarker coordinates={[41.452746, 52.722408]} draggable={true}>
                <section>
                <h1>You can drag this header</h1>
                </section>
            </YMapMarker> */}
        {polygons.map((polygon) => (
          <PolygonItem key={polygon.district_id} geom={polygon.geom} />
        ))}
        {marks.map((mark) => (
          <MarkItem key={mark.district_id} mark={mark} />
        ))}
        <YMapDefaultMarker
          coordinates={[userLocation?.longitude, userLocation?.latitude]}
          color={"white"}
        />
      </YMap>
    </YMapComponentsProvider>
  );
}

function PolygonItem({ geom }: { geom: Geometry }) {
  return (
    <YMapFeature
      style={{
        stroke: [
          {
            color: '#36FF58',
            width: 2,
          }
        ],
        fill: '#36FF58',
        fillOpacity: 0.05,
      }}
      geometry={geom}
    />
  );
}

function MarkItem({ mark }: { mark: Mark }) {
  return (
    <YMapDefaultMarker
      coordinates={mark.geom.coordinates}
      color={COLOR_TYPES_MARK[mark.type_mark_id]}
    />
  );
}