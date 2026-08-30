import { observer } from "mobx-react-lite";

import { useT } from "../../i18n";
import { heatColors, heatLegend } from "../../utils/heatmap";
import { useTheme } from "../../theme";
import heatmapStore from "../../store/heatmap";

/** Reads the heatmap's colour ramp back as numbers of marks per cell. */
const HeatmapLegend = observer(() => {
    const { t } = useT();
    const { resolved } = useTheme();
    const { maxCount, isLoading, features } = heatmapStore;
    const steps = heatLegend(maxCount, heatColors(resolved));
    return (
        <div className="heatmap-legend" aria-label={t("map.heatLegendAria")}>
            <p className="heatmap-legend__title">{t("map.heatLegendTitle")}{isLoading && ` · ${t("common.loading")}`}</p>
            {features.length === 0 && !isLoading && <p className="heatmap-legend__empty">{t("map.heatLegendEmpty")}</p>}
            {steps.map((step) => (
                <div key={step.label} className="heatmap-legend__row">
                    <i style={{ backgroundColor: step.color }} aria-hidden="true" />
                    <span>{step.label}</span>
                </div>
            ))}
        </div>
    );
});

export default HeatmapLegend;
