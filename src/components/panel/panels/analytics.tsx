import { memo, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import markStatusesStore from "../../../store/mark-statuses";
import AnalyticsService, { AnalyticsRequest, Kpi, TimeseriesPoint, TimeseriesStep } from "../../../services/AnalyticsService";
import { TranslationKey, useT } from "../../../i18n";
import { statusColors, STATUS_FALLBACK } from "../../../styles/tokens";
import { useTheme } from "../../../theme";
import { ChartSeries, DEFAULT_CHART_LAYOUT, hoursFigure, linePoints, niceMax, periodLabel, pointX, pointY, shareFigure, toIsoDate, yTicks } from "../../../utils/chart";
import { useAsyncData } from "../../../utils/use-async-data";
import PanelHeader from "../panel-header";
import "./analytics.scss";
import { BoundarySelect, PanelControls, SelectField } from "../panel-controls";

// Colours come from the token layer through `var()`, applied as inline CSS rather
// than as SVG presentation attributes: the chart used to carry its own literals,
// which is why its grid and axis labels were unreadable under the dark theme.
const SERIES_META: { key: keyof Omit<TimeseriesPoint, "period">; label: TranslationKey; color: string }[] = [
    { key: "created", label: "analytics.series.created", color: "var(--series-created)" },
    { key: "confirmed", label: "analytics.series.confirmed", color: "var(--series-confirmed)" },
    { key: "closed", label: "analytics.series.closed", color: "var(--series-closed)" },
    { key: "refuted", label: "analytics.series.refuted", color: "var(--series-refuted)" },
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

/**
 * The figures.
 *
 * One headline number and five supporting ones, rather than six tiles of equal
 * weight -- "всего проблем" and "доля опровергнутых" were the same size, which
 * says they matter equally. The unit is set apart from the figure so a column of
 * numbers still lines up.
 *
 * The status breakdown is a share of one whole, not six independent values, so
 * it is drawn as one bar in the colours the map already uses for those statuses.
 */
const StatTiles = observer(function StatTiles({ kpi }: { kpi: Kpi }) {
    const { t } = useT();
    const { resolved } = useTheme();
    const statuses = statusColors(resolved);
    const statusName = (id: string) => markStatusesStore.statuses.find((s) => String(s.mark_status_id) === id)?.name ?? t("common.statusN", { id });
    const byStatus = Object.entries(kpi.by_status ?? {}).sort(([a], [b]) => Number(a) - Number(b));
    const statusTotal = byStatus.reduce((sum, [, count]) => sum + count, 0);

    const figures = [
        { label: t("analytics.olderThan30"), ...{ value: String(kpi.open_older_than_30d ?? 0), unit: "" } },
        { label: t("analytics.avgConfirm"), ...hoursFigure(kpi.avg_confirm_hours) },
        { label: t("analytics.medianConfirm"), ...hoursFigure(kpi.median_confirm_hours) },
        { label: t("analytics.avgClose"), ...hoursFigure(kpi.avg_close_hours) },
        { label: t("analytics.refutedShare"), ...shareFigure(kpi.refuted_share) },
    ];

    return (
        <>
            <div className="kpi-hero">
                <b>{kpi.total}</b>
                <span>{t("analytics.total")}</span>
            </div>
            <div className="kpi-figures">
                {figures.map((figure) => (
                    <div key={figure.label} className="kpi-figure">
                        <b>{figure.value}{figure.unit && <em>{figure.unit}</em>}</b>
                        <span>{figure.label}</span>
                    </div>
                ))}
            </div>
            {statusTotal > 0 &&
                <>
                    <h2 className="section-title">{t("analytics.byStatus")}</h2>
                    <div className="kpi-share" role="img" aria-label={t("analytics.byStatus")}>
                        {byStatus.map(([id, count]) => (
                            <i
                                key={id}
                                style={{ flexGrow: count, backgroundColor: statuses[Number(id)] ?? STATUS_FALLBACK }}
                            />
                        ))}
                    </div>
                    <ul className="kpi-share__list">
                        {byStatus.map(([id, count]) => (
                            <li key={id}>
                                <i style={{ backgroundColor: statuses[Number(id)] ?? STATUS_FALLBACK }} aria-hidden="true" />
                                <span>{statusName(id)}</span>
                                <b>{count}</b>
                                <em>{Math.round((count / statusTotal) * 100)}%</em>
                            </li>
                        ))}
                    </ul>
                </>
            }
        </>
    );
});


/**
 * The dynamics chart: plain SVG, no chart library.
 *
 * "Created" is drawn as bars, the rest as lines. That is not decoration -- a
 * count of events inside an interval is discrete, and a line between two such
 * points draws an interpolation that never happened. It also separates the one
 * series that is a rate of arrival from the three that track what became of them.
 *
 * Every colour resolves through `var()` from the token layer. The chart used to
 * hold its own literals -- #e5e5e5 for the grid, #555 for the axis labels -- so
 * on the dark theme the grid outshone the data and the labels sat at 1.66:1.
 */
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
    const [bars, ...lines] = series;
    const plotWidth = width - padding.left - padding.right;
    const barWidth = Math.max(2, (plotWidth / Math.max(points.length, 1)) * 0.55);
    const baseY = height - padding.bottom;

    return (
        <div className="chart">
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={t("analytics.chartAria")} className="chart__canvas">
                {ticks.map((tick) => {
                    const y = pointY(tick, yMax, layout);
                    return (
                        <g key={tick}>
                            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart__grid" />
                            <text x={padding.left - 4} y={y + 3} fontSize={8} textAnchor="end" className="chart__label">{Math.round(tick)}</text>
                        </g>
                    );
                })}
                {points.map((p, i) => {
                    if (i % labelEvery !== 0 && i !== points.length - 1) {
                        return null;
                    }
                    const x = pointX(i, points.length, layout);
                    return (
                        <text key={p.period} x={x} y={height - 6} fontSize={8} textAnchor="middle" className="chart__label">{periodLabel(p.period)}</text>
                    );
                })}
                {bars.values.map((value, i) => {
                    const x = pointX(i, points.length, layout);
                    const y = pointY(value, yMax, layout);
                    return (
                        <rect
                            key={points[i].period}
                            x={x - barWidth / 2}
                            y={y}
                            width={barWidth}
                            height={Math.max(0, baseY - y)}
                            rx={1}
                            className="chart__bar"
                            style={{ fill: bars.color }}
                        />
                    );
                })}
                {lines.map((s) => (
                    <polyline
                        key={s.key}
                        points={linePoints(s.values, yMax, layout)}
                        fill="none"
                        strokeWidth={1.6}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        style={{ stroke: s.color }}
                    />
                ))}
                {/* a polyline with a single point is invisible: draw a dot per series instead */}
                {points.length === 1 && lines.map((s) => (
                    <circle key={s.key} cx={pointX(0, 1, layout)} cy={pointY(s.values[0], yMax, layout)} r={3} style={{ fill: s.color }} />
                ))}
            </svg>
            {/* The legend carries each series' latest value: four lines with nothing
                to hover gave the reader no way to read one off the chart. */}
            <div className="chart-legend">
                {series.map((s) => (
                    <div key={s.key} className="chart-legend__item">
                        <i className={s.key === "created" ? "chart-legend__bar" : undefined} style={{ backgroundColor: s.color }} aria-hidden="true" />
                        {t(s.label as TranslationKey)}
                        <b>{s.values[s.values.length - 1] ?? 0}</b>
                    </div>
                ))}
            </div>
        </div>
    );
});

export default Analytics;
