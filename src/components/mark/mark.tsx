import { LngLat, PointGeometry } from "@yandex/ymaps3-types";
import { YMapMarker } from "ymap3-components";

import "./marker.scss"

export interface Mark {
  mark_id: number;
  name: string;
  geom: PointGeometry,
  type_mark_id: number;
  user_id: number;
  district_id: number;
  number_votes: number;
  number_checks: number;
}

export enum MarkerSize {
  small = 'small',
  big = 'big',
  medium = 'medium'
}

const COLOR_TYPES_MARK = {
  1: "#00e500",
  2: "#e50000",
} as {
  [index: number]: string
}

export default function MarkItem({ mark, size }: { mark: Mark, size: MarkerSize }) {
  return (
    <YMapMarker
      coordinates={mark.geom.coordinates}
    >
      <div className={`mark ${size}`} style={{ backgroundColor: COLOR_TYPES_MARK[mark.type_mark_id] }}>
        {size == MarkerSize.big &&
          <div className="mark__number-checks-box">
            {mark.number_checks}
          </div>
        }
      </div>
    </YMapMarker>
  );
}



export function MarkerItem({ coordinates, color }: { coordinates: LngLat, color: string }) {
  return (
    <YMapMarker
      coordinates={coordinates}
    >
      <div className="mark medium" style={{ backgroundColor: color }}>
        <div>

        </div>
      </div>
    </YMapMarker>
  );
}