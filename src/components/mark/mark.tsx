import { LngLat } from "@yandex/ymaps3-types";
import { YMapMarker } from "ymap3-components";

import "./marker.scss"
import { memo } from "react";
import { Mark } from "../../services/MarksService";

import BlobIcon from "../../assets/blob.svg?react"
import RoadIcon from "../../assets/road.svg?react"
import SignIcon from "../../assets/sign.svg?react"
import TreeIcon from "../../assets/tree.svg?react"
import TrashIcon from "../../assets/trash.svg?react"


export enum MarkerSize {
  small = 'small',
  big = 'big',
  medium = 'medium'
};

export const COLOR_MARK_STATUSES = {
  1: "#d3d3d3",
  2: "#e50000",
  4: "#e50000",
  3: "#e5d600",
  5: "#00e500",
  6: "#000",
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
  4: Blob,
  5: Sign,
};

export function Trash({ color }: { color: string }) {
  return (
    <TrashIcon
      style={{
        minWidth: "16px",
        maxWidth: "16px",
        minHeight: "16px",
        maxHeight: "16px",
        fill: color
      }}
    />
  );
}

export function Trees({ color }: { color: string }) {
  return (
    <TreeIcon
      style={{
        minWidth: "16px",
        maxWidth: "16px",
        minHeight: "16px",
        maxHeight: "16px",
        fill: color
      }}
    />
  );
}

export function Road({ color }: { color: string }) {
  return (
    <RoadIcon
      style={{
        minWidth: "16px",
        maxWidth: "16px",
        minHeight: "16px",
        maxHeight: "16px",
        fill: color
      }}
    />
  );
}

export function Blob({ color }: { color: string }) {
  return (
    <BlobIcon
      style={{
        minWidth: "16px",
        maxWidth: "16px",
        minHeight: "16px",
        maxHeight: "16px",
        fill: color
      }}
    />
  )
}

export function Sign({ color }: { color: string }) {
  return (
    <SignIcon
      style={{
        minWidth: "16px",
        maxWidth: "16px",
        minHeight: "16px",
        maxHeight: "16px",
        fill: color
      }}
    />
  )
}

interface MarkItemProps {
  mark: Mark;
  size: MarkerSize;
  selected: boolean;
  assigned: boolean;
  onClick: (mark: Mark) => void;
}

const MarkItem = memo(function ({ mark, size, selected, assigned, onClick }: MarkItemProps) {
  const color = COLOR_MARK_STATUSES[mark.mark_status_id];

  return (
    <YMapMarker
      source="markerSource"
      coordinates={mark.geom.coordinates}
      onClick={() => { onClick(mark) }}
    >
      <div
        className={`mark ${size} ${selected ? "selected" : ""} ${assigned ? "assigned" : ""}`}
        style={{ backgroundColor: color }}
      >
        {size == MarkerSize.big &&
          <>
            <div className="circle-content" style={{ backgroundColor: color }}>
              {TypeMarkIcons[mark.mark_type_id]({ color: "#fff" })}
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
      source="markerSource"
    >
      <div className="mark medium" style={{ backgroundColor: color }}>
        <div>

        </div>
      </div>
    </YMapMarker>
  );
}