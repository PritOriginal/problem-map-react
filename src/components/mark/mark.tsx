import { LngLat } from "@yandex/ymaps3-types";
import { YMapMarker } from "ymap3-components";

import "./marker.scss"
import { memo } from "react";
import { Mark, MarkType } from "../../services/MarksService";
import { typeColor, typeIcon } from "../../utils/mark-types";
import { contrastOn, statusColors, STATUS_FALLBACK } from "../../styles/tokens";
import { useTheme } from "../../theme";

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

/**
 * Icon of a mark type: the backend `icon` (emoji) when present, else the built-in SVG by id,
 * else the first letter of the type name.
 */
export function TypeIcon({ typeId, type, color }: { typeId: number; type?: MarkType; color: string }) {
  const glyph = typeIcon(type);
  if (glyph) {
    return <span className="type-glyph" aria-hidden="true">{glyph}</span>;
  }
  const Builtin = TypeMarkIcons[typeId];
  if (Builtin) {
    return Builtin({ color });
  }
  return <span className="type-glyph" style={{ color }} aria-hidden="true">{(type?.name ?? "?").slice(0, 1).toUpperCase()}</span>;
}

interface MarkItemProps {
  mark: Mark;
  type?: MarkType;
  size: MarkerSize;
  selected: boolean;
  /** A task on this mark is assigned to the current user. */
  assigned?: boolean;
  onClick: (mark: Mark) => void;
}

const MarkItem = memo(function ({ mark, type, size, selected, assigned = false, onClick }: MarkItemProps) {
  const { resolved } = useTheme();
  const color = statusColors(resolved)[mark.mark_status_id] ?? STATUS_FALLBACK;
  const ring = typeColor(type);

  return (
    <YMapMarker
      source="markerSource"
      coordinates={mark.geom.coordinates}
      onClick={() => { onClick(mark) }}
    >
      <div
        className={`mark ${size} ${selected ? "selected" : ""} ${mark.hidden ? "hidden-mark" : ""} ${assigned ? "assigned" : ""}`}
        style={{ backgroundColor: color, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }}
        title={mark.hidden ? "hidden" : undefined}
      >
        {size == MarkerSize.big &&
          <>
            <div className="circle-content" style={{ backgroundColor: ring ?? color }}>
              <TypeIcon typeId={mark.mark_type_id} type={type} color={contrastOn(ring ?? color)} />
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
      source="markerSource"
      coordinates={coordinates}
    >
      <div className="mark medium" style={{ backgroundColor: color }}>
        <div>

        </div>
      </div>
    </YMapMarker>
  );
}