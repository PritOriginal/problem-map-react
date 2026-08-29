import { memo } from "react";
import { YMapFeature } from "ymap3-components";

import { useTheme } from "../../theme";
import { themeColors } from "../../styles/tokens";
import type { AdminBoundary, AdminBoundaryMarksCount } from "../../services/MapService";
import { getColorPolygon } from "../map-colors";

/** One administrative boundary, washed in the colour of how its marks are doing. */
const BoundaryItem = memo(function ({ boundary, count }: { boundary: AdminBoundary, count: AdminBoundaryMarksCount | undefined }) {
    const { resolved } = useTheme();
    const color = "#" + getColorPolygon(count);
    return (
        <YMapFeature
            source="boundariesSource"
            style={{
                stroke: [
                    {
                        color: themeColors(resolved)["--ink"],
                        width: 1,
                        opacity: 0.5,
                    }
                ],
                fill: color,
                // The same alpha does not read the same on both basemaps. Over the light
                // ground a 10% red wash is a pale pink; over the near-black one it is the
                // only luminance in the frame, and a single district at close zoom turns
                // the whole map brown. Halved on dark to keep the tint at the strength it
                // was designed for.
                fillOpacity: (0.01 + 0.09 * Math.exp(boundary.admin_level - 10)) * (resolved === "dark" ? 0.5 : 1),
            }}
            geometry={boundary.geom}
        />
    );
});

export default BoundaryItem;
