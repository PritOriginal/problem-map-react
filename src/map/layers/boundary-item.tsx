import { memo } from "react";
import { YMapFeature } from "ymap3-components";

import { useTheme } from "../../theme";
import { BASEMAP } from "../basemap/basemap";
import { themeColors } from "../../styles/tokens";
import type { AdminBoundary, AdminBoundaryMarksCount } from "../../services/MapService";
import { getColorPolygon } from "../map-colors";

/** One administrative boundary, washed in the colour of how its marks are doing. */
const BoundaryItem = memo(function ({ boundary, count }: { boundary: AdminBoundary, count: AdminBoundaryMarksCount | undefined }) {
    const { resolved } = useTheme();
    const { tone, strokeMode, strokeOpacity, fillScale } = BASEMAP[resolved].boundary;
    const color = "#" + getColorPolygon(count, tone);

    return (
        <YMapFeature
            source="boundariesSource"
            style={{
                stroke: [
                    {
                        // An edge in the interface's ink is a white grid laid over a night
                        // map: the loudest thing in the frame, drawn for the least important
                        // one. "self" draws it in the wash's own colour instead, so the
                        // boundary states what the district is doing rather than merely
                        // where it ends.
                        color: strokeMode === "self" ? color : themeColors(resolved)["--ink"],
                        width: 1,
                        opacity: strokeOpacity,
                    }
                ],
                fill: color,
                // The same alpha does not read the same on both basemaps. Over paper a 10%
                // wash is a pale tint; over near-black the same 10% of a saturated hue is
                // indistinguishable from the ground -- the colour is there and carries no
                // information. So the dark arms take the alpha UP and the saturation down:
                // a pale hue at a fifth of alpha reads as colour, where a deep one at a
                // twentieth reads as dirt.
                fillOpacity: (0.01 + 0.09 * Math.exp(boundary.admin_level - 10)) * fillScale,
            }}
            geometry={boundary.geom}
        />
    );
});

export default BoundaryItem;
