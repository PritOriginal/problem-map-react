import { LngLat } from "@yandex/ymaps3-types";
import { YMapMarker } from "ymap3-components";
import { ComponentType, ReactNode, SVGProps } from "react";

import "./marker.scss"
import { observer } from "mobx-react-lite";
import { Mark, MarkType } from "../../services/MarksService";
import selectedMark from "../../store/selected_mark";
import tasksStore from "../../store/tasks";
import { typeColor, typeIcon } from "../../utils/mark-types";
import { MARKER_ICON, statusColors, STATUS_FALLBACK } from "../../styles/tokens";
import { useTheme } from "../../theme";
import { MarkerSize } from "./marker-size";

import BlobIcon from "../../assets/blob.svg?react"
import RoadIcon from "../../assets/road.svg?react"
import SignIcon from "../../assets/sign.svg?react"
import TreeIcon from "../../assets/tree.svg?react"
import TrashIcon from "../../assets/trash.svg?react"

type SVGComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Built-in icon per mark type id, for the types the backend ships without an `icon` emoji.
 * Five components that differed only in the SVG they imported are this table instead: the
 * size already lives in `.type-svg`, so all that was left per entry was the file name.
 */
const TYPE_ICON_COMPONENTS: Record<number, SVGComponent> = {
    1: TrashIcon,
    2: TreeIcon,
    3: RoadIcon,
    4: BlobIcon,
    5: SignIcon,
};

/** The built-in SVG for a type id, or `null` when there is none — the caller then falls back. */
export function TypeMarkIcon({ typeId, color }: { typeId: number; color: string }): ReactNode {
    const Icon = TYPE_ICON_COMPONENTS[typeId];
    if (!Icon) {
        return null;
    }
    return <Icon className="type-svg" style={{ fill: color }} />;
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
    const builtin = TypeMarkIcon({ typeId, color });
    if (builtin) {
        return builtin;
    }
    return <span className="type-glyph" style={{ color }} aria-hidden="true">{(type?.name ?? "?").slice(0, 1).toUpperCase()}</span>;
}

interface MarkItemProps {
    mark: Mark;
    type?: MarkType;
    size: MarkerSize;
    onClick: (mark: Mark) => void;
}

/**
 * A single map marker.
 *
 * Selection and "assigned to me" are read from the stores here rather than passed
 * down: as props they would change the identity of the `marker` callback the
 * clusterer is given, and every click would rebuild every marker. As observed
 * state they repaint exactly the two markers that changed.
 */
const MarkItem = observer(function MarkItem({ mark, type, size, onClick }: MarkItemProps) {
    const { resolved } = useTheme();
    const selected = selectedMark.id === mark.mark_id;
    const assigned = tasksStore.assignedMarkIds.has(mark.mark_id);
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
                    <div className="circle-content icon-on-fill" style={{ backgroundColor: ring ?? color }}>
                        <TypeIcon typeId={mark.mark_type_id} type={type} color={MARKER_ICON} />
                    </div>
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
