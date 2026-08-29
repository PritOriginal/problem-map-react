import { memo } from "react";
import { observer } from "mobx-react-lite";
import { YMapFeature } from "ymap3-components";

import { useTheme } from "../../theme";
import { themeColors } from "../../styles/tokens";
import { heatColor } from "../../utils/heatmap";
import type { HeatmapFeature } from "../../services/MapService";
import heatmapStore from "../../store/heatmap";

const HeatmapCell = memo(function ({ feature, max }: { feature: HeatmapFeature, max: number }) {
    const { resolved } = useTheme();
    // empty cells are filtered out in the store, before the element is built
    const count = feature.properties?.count ?? 0;
    return (
        <YMapFeature
            style={{
                stroke: [{ color: themeColors(resolved)["--paper"], width: 0.5, opacity: 0.6 }],
                fill: heatColor(count, max),
                fillOpacity: 0.55,
            }}
            geometry={feature.geometry}
            properties={{ count }}
        />
    );
});

/** Grid cells of the heatmap, filled by the number of marks in each. */
const HeatmapLayer = observer(() => {
    const { visibleFeatures, maxCount } = heatmapStore;
    return (
        <>
            {visibleFeatures.map((feature, index) => (
                <HeatmapCell key={feature.id ?? index} feature={feature} max={maxCount} />
            ))}
        </>
    );
});

export default HeatmapLayer;
