import { LngLat } from "@yandex/ymaps3-types";
import { YMapMarker } from "ymap3-components";

import "./marker.scss"
import { memo } from "react";
import { Mark } from "../../services/MarksService";


export enum MarkerSize {
  small = 'small',
  big = 'big',
  medium = 'medium'
};

export const COLOR_MARK_STATUSES = {
  1: "#d3d3d3ff",
  2: "#e50000",
  3: "#00e500",
} as {
  [index: number]: string
};

interface TypeMarkIcons {
  [key: number]: ({ color }: { color: string }) => JSX.Element;
}

export const TypeMarkIcons: TypeMarkIcons = {
  1: Trash,
  2: Trees,
  3: Road,
};

export function Trash({ color }: { color: string }) {
  return (
    <svg fill={color} width="16px" height="16px" version="1.1" viewBox="0 0 31.064 37.636" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(84.222 -6.0255)">
        <path d="m-78.369 6.0255-1.7746 7.0509h-4.0778l7.0926 30.586h16.884l7.0869-30.586h-4.1129l-2.4774-7.0509zm3.05 3.0971h12.775l1.1444 3.7679h-14.74zm-6.086 7.1318h2.774l4.3357 24.831h-1.572zm22.794 0h2.7735l-5.5371 24.831h-1.5725z" />
      </g>
    </svg>
  );
}

export function Trees({ color }: { color: string }) {
  return (
    <svg fill={color} width="16px" height="16px" version="1.1" viewBox="0 0 31.418 41.428" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(-17.501 -4.5119)">
        <circle cx="24.269" cy="19.62" r="6.7679" />
        <circle cx="32.404" cy="12.442" r="7.9301" />
        <circle cx="40.65" cy="16.112" r="5.9476" />
        <ellipse cx="44.886" cy="22.877" rx="4.0334" ry="3.8967" />
        <path d="m34.318 19.005-2.5978 0.13642-0.68368 8.7504-2.188-4.5119-2.3239 1.6407 3.9646 4.9222-1.7089 15.997h8.4088l-2.051-16.681 7.1096-4.1016-0.54674-1.5043-6.1526 3.4184 3.6918-6.1526-1.3674-1.094-3.145 5.8792z" />
      </g>
    </svg>

  );
}

export function Road({ color }: { color: string }) {
  return (
    <svg  fill={color} width="16px" height="16px" version="1.1" viewBox="0 0 30.97 26.483" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(101.34 -2.4747)">
        <path d="m-94.298 2.4747-7.0456 26.483h30.97l-7.0404-26.483zm7.32 1.0759h2.2397l0.21187 2.4133-2.6644 0.010852zm2.5564 3.6034 0.26458 3.0091-3.4034 0.01344 0.26458-3.0112zm0.44752 5.0917 0.41238 4.6948-4.5951 0.01809 0.4129-4.6979zm-4.4623 7.8956h5.1563l0.60616 6.8988h-6.3691z" />
      </g>
    </svg>
  );
}

const MarkItem = memo(function ({ mark, size, selected, onClick }: { mark: Mark, size: MarkerSize, selected: boolean, onClick: (mark: Mark) => void }) {
  const color = COLOR_MARK_STATUSES[mark.mark_status_id];

  return (
    <YMapMarker
      coordinates={mark.geom.coordinates}
      onClick={() => { onClick(mark) }}
    >
      <div className={`mark ${size} ${selected ? "selected" : ""}`} style={{ backgroundColor: color }}>
        {size == MarkerSize.big &&
          <>
            <div className="circle-content" style={{ backgroundColor: color }}>
              {TypeMarkIcons[mark.type_mark_id]({ color: "#fff" })}
            </div>
            <div className="mark__number-checks-box">
              {mark.number_checks}
            </div>
          </>
        }
      </div>
    </YMapMarker>
  );
})

export default MarkItem;



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