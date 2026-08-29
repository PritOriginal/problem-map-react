import { memo, useEffect, useMemo, useState } from "react";
import { StatTile } from "../../stat-tile/stat-tile";
import { observer } from "mobx-react-lite";
import markStatusesStore from "../../../store/mark-statuses";
import AnalyticsService, { AnalyticsRequest, Kpi, TimeseriesPoint, TimeseriesStep } from "../../../services/AnalyticsService";
import { TranslationKey, useT } from "../../../i18n";
import { SERIES_COLORS } from "../../../styles/tokens";
import { ChartSeries, DEFAULT_CHART_LAYOUT, formatHours, formatShare, linePoints, niceMax, periodLabel, pointX, pointY, toIsoDate, yTicks } from "../../../utils/chart";
import { useAsyncData } from "../../../utils/use-async-data";
import PanelHeader from "../panel-header";
import { BoundarySelect, PanelControls, SelectField } from "../panel-controls";

const SERIES_META: { key: keyof Omit<TimeseriesPoint, "period">; label: TranslationKey; color: string }[] = [
    { key: "created", label: "analytics.series.created", color: SERIES_COLORS.created },
    { key: "confirmed", label: "analytics.series.confirmed", color: SERIES_COLORS.confirmed },
    { key: "closed", label: "analytics.series.closed", color: SERIES_COLORS.closed },
    { key: "refuted", label: "analytics.series.refuted", color: SERIES_COLORS.refuted },
];

const PERIOD_PRESETS: { label: TranslationKey; days: number }[] = [
    { label: "analytics.preset.30", days: 30 },
    { label: "analytics.preset.90", days: 90 },
    { label: "analytics.preset.365", days: 365 },
];

function defaultRange(days: number): { from: string; to: string } {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    return { from: toIsoDate(from), to: toIsoDate(to) };
}

const Analytics = observer(function Analytics() {
    const { t } = useT();

    useEffect(() => {
        if (markStatusesStore.statuses.length === 0 && !markStatusesStore.isLoading) {
            markStatusesStore.fetch();
        }
    }, []);

    const [boundaryId, setBoundaryId] = useState(0);
    const [range, setRange] = useState(() => defaultRange(90));
    const [step, setStep] = useState<TimeseriesStep>("week");

    const request: AnalyticsRequest = useMemo(() => ({
        boundary_id: boundaryId || undefined,
        from: range.from || undefined,
        to: range.to || undefined,
    }), [boundaryId, range.from, range.to]);

    // Two independent reads with two different messages. `Promise.allSettled` was only
    // ever a way to keep one failure from taking the other panel half down with it, and
    // two hooks do that on their own.
    const { data: kpi = null, isLoading: kpiLoading } = useAsyncData(
        (signal) => AnalyticsService.getKpi(request, { signal }).then((res) => res.payload),
        [request],
        { errorMessage: t("analytics.kpiFailed") },
    );

    const { data: series = [], isLoading: seriesLoading } = useAsyncData(
        (signal) => AnalyticsService.getTimeseries(request, step, { signal }).then((res) => res.payload ?? []),
        [request, step],
        { errorMessage: t("analytics.tsFailed") },
    );

    const isLoading = kpiLoading || seriesLoading;

    const stepOptions: { value: TimeseriesStep; label: string }[] = useMemo(() => [
        { value: "day", label: t("analytics.step.day") },
        { value: "week", label: t("analytics.step.week") },
        { value: "month", label: t("analytics.step.month") },
    ], [t]);

    return (
        <>
            <PanelHeader openOnMount title={t("analytics.title")} subtitle={t("analytics.subtitle")} />
            <div className="panel__content">
                <PanelControls>
                    <BoundarySelect span label={t("analytics.district")} value={boundaryId} onChange={setBoundaryId} />
                    <label>
                        {t("analytics.from")}
                        <input type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
                    </label>
                    <label>
                        {t("analytics.to")}
                        <input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />
                    </label>
                    <div className="analytics-controls__span" style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {PERIOD_PRESETS.map((preset) => (
                            <button key={preset.days} type="button" className="btn-secondary mini" onClick={() => setRange(defaultRange(preset.days))}>
                                {t(preset.label)}
                            </button>
                        ))}
                    </div>
                    <SelectField label={t("analytics.step")} value={step} options={stepOptions} onChange={setStep} />
                </PanelControls>
                <hr />
                <h2 className="section-title">{t("analytics.kpi")}<span className="section-title__count">{isLoading && <span style={{ fontSize: 12 }}>{t("common.loading")}</span>}</span></h2>
                {kpi ? <StatTiles kpi={kpi} /> : !isLoading && <p className="empty-state">{t("common.noData")}</p>}
                <hr />
                <h2 className="section-title">{t("analytics.dynamics")}</h2>
                <LineChart points={series} />
            </div>
        </>
    );
});

const StatTiles = observer(function StatTiles({ kpi }: { kpi: Kpi }) {
    const { t } = useT();
    const statusName = (id: string) => markStatusesStore.statuses.find((s) => String(s.mark_status_id) === id)?.name ?? t("common.statusN", { id });
    const byStatus = Object.entries(kpi.by_status ?? {}).sort(([a], [b]) => Number(a) - Number(b));
    return (
        <>
            <div className="stat-grid">
                <StatTile value={kpi.total} label={t("analytics.total")} />
                <StatTile value={kpi.open_older_than_30d ?? 0} label={t("analytics.olderThan30")} />
                <StatTile value={formatHours(kpi.avg_confirm_hours)} label={t("analytics.avgConfirm")} />
                <StatTile value={formatHours(kpi.median_confirm_hours)} label={t("analytics.medianConfirm")} />
                <StatTile value={formatHours(kpi.avg_close_hours)} label={t("analytics.avgClose")} />
                <StatTile value={formatShare(kpi.refuted_share)} label={t("analytics.refutedShare")} />
            </div>
            {byStatus.length > 0 &&
                <div className="stat-grid">
                    {byStatus.map(([id, count]) => <StatTile key={id} value={count} label={statusName(id)} />)}
                </div>
            }
        </>
    );
});


/** Plain-SVG multi-series line chart (no chart libraries). */
export const LineChart = memo(function LineChart({ points }: { points: TimeseriesPoint[] }) {
    const { t } = useT();
    const layout = DEFAULT_CHART_LAYOUT;
    const { width, height, padding } = layout;
    const series: ChartSeries[] = SERIES_META.map((meta) => ({
        ...meta,
        values: points.map((p) => p[meta.key] ?? 0),
    }));
    const rawMax = series.reduce((m, s) => Math.max(m, ...s.values), 0);
    const yMax = niceMax(rawMax);
    const ticks = yTicks(yMax);

    if (points.length === 0) {
        return <p className="empty-state">{t("analytics.noDataPeriod")}</p>;
    }

    const labelEvery = Math.max(1, Math.ceil(points.length / 6));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={t("analytics.chartAria")} style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}>
                {ticks.map((t) => {
                    const y = pointY(t, yMax, layout);
                    return (
                        <g key={t}>
                            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e5e5e5" strokeWidth={1} />
                            <text x={padding.left - 4} y={y + 3} fontSize={8} textAnchor="end" fill="#555">{Math.round(t)}</text>
                        </g>
                    );
                })}
                {points.map((p, i) => {
                    if (i % labelEvery !== 0 && i !== points.length - 1) {
                        return null;
                    }
                    const x = pointX(i, points.length, layout);
                    return (
                        <text key={p.period} x={x} y={height - 6} fontSize={8} textAnchor="middle" fill="#555">{periodLabel(p.period)}</text>
                    );
                })}
                {series.map((s) => (
                    <polyline key={s.key} points={linePoints(s.values, yMax, layout)} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
                ))}
                {/* a polyline with a single point is invisible: draw a dot per series instead */}
                {points.length === 1 && series.map((s) => (
                    <circle key={s.key} cx={pointX(0, 1, layout)} cy={pointY(s.values[0], yMax, layout)} r={3} fill={s.color} />
                ))}
            </svg>
            <div className="chart-legend">
                {series.map((s) => (
                    <div key={s.key} className="chart-legend__item">
                        <i style={{ backgroundColor: s.color }} aria-hidden="true" />
                        {t(s.label as TranslationKey)}
                    </div>
                ))}
            </div>
        </div>
    );
});

export default Analytics;
