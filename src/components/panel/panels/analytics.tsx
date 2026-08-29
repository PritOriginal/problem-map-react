import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import panelStore from "../../../store/panel";
import notificationsStore from "../../../store/notifications";
import adminBoundariesStore from "../../../store/admin-boundaries";
import markStatusesStore from "../../../store/mark-statuses";
import AnalyticsService, { AnalyticsRequest, Kpi, TimeseriesPoint, TimeseriesStep } from "../../../services/AnalyticsService";
import { ChartSeries, DEFAULT_CHART_LAYOUT, formatHours, formatShare, linePoints, niceMax, periodLabel, toIsoDate, yTicks } from "../../../utils/chart";

const SERIES_META: { key: keyof Omit<TimeseriesPoint, "period">; label: string; color: string }[] = [
    { key: "created", label: "Создано", color: "#1f77b4" },
    { key: "confirmed", label: "Подтверждено", color: "#e50000" },
    { key: "closed", label: "Решено", color: "#00a000" },
    { key: "refuted", label: "Опровергнуто", color: "#000" },
];

const PERIOD_PRESETS: { label: string; days: number }[] = [
    { label: "30 дней", days: 30 },
    { label: "90 дней", days: 90 },
    { label: "Год", days: 365 },
];

function defaultRange(days: number): { from: string; to: string } {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    return { from: toIsoDate(from), to: toIsoDate(to) };
}

const Analytics = observer(function Analytics() {
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight);
            panelStore.setOpen(true);
        }
    }, []);

    useEffect(() => {
        if (adminBoundariesStore.boundaries.length === 0 && !adminBoundariesStore.isLoadingBoundaries) {
            adminBoundariesStore.fetchBoundaries();
        }
        if (markStatusesStore.statuses.length === 0 && !markStatusesStore.isLoading) {
            markStatusesStore.fetch();
        }
    }, []);

    const [boundaryId, setBoundaryId] = useState(0);
    const [range, setRange] = useState(() => defaultRange(90));
    const [step, setStep] = useState<TimeseriesStep>("week");

    const [kpi, setKpi] = useState<Kpi | null>(null);
    const [series, setSeries] = useState<TimeseriesPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const request: AnalyticsRequest = useMemo(() => ({
        boundary_id: boundaryId || undefined,
        from: range.from || undefined,
        to: range.to || undefined,
    }), [boundaryId, range.from, range.to]);

    useEffect(() => {
        let ignore = false;
        setIsLoading(true);
        Promise.allSettled([
            AnalyticsService.getKpi(request),
            AnalyticsService.getTimeseries(request, step),
        ]).then(([kpiRes, tsRes]) => {
            if (ignore) {
                return;
            }
            setIsLoading(false);
            if (kpiRes.status === "fulfilled") {
                setKpi(kpiRes.value.payload);
            } else {
                console.error(kpiRes.reason);
                notificationsStore.showError(kpiRes.reason, "Не удалось загрузить показатели");
            }
            if (tsRes.status === "fulfilled") {
                setSeries(tsRes.value.payload ?? []);
            } else {
                console.error(tsRes.reason);
                notificationsStore.showError(tsRes.reason, "Не удалось загрузить динамику");
            }
        });
        return () => {
            ignore = true;
        };
    }, [request, step]);

    const boundaries = [...adminBoundariesStore.boundaries].sort((a, b) => a.admin_level - b.admin_level || a.name.localeCompare(b.name));

    return (
        <>
            <div ref={panelHeaderRef} className="panel__header" onClick={() => panelStore.toggle()}>
                <p><b>Аналитика</b></p>
                <p style={{ fontSize: 12 }}>Показатели по проблемам за период</p>
            </div>
            <div className="panel__content">
                <div className="analytics-controls">
                    <label style={{ gridColumn: "1 / -1" }}>
                        Район
                        <select value={boundaryId} onChange={(e) => setBoundaryId(Number(e.target.value))}>
                            <option value={0}>Весь город</option>
                            {boundaries.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        С
                        <input type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
                    </label>
                    <label>
                        По
                        <input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />
                    </label>
                    <div style={{ display: "flex", gap: "4px", gridColumn: "1 / -1", flexWrap: "wrap" }}>
                        {PERIOD_PRESETS.map((preset) => (
                            <button key={preset.days} type="button" className="white-2-black mini" onClick={() => setRange(defaultRange(preset.days))}>
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    <label>
                        Шаг графика
                        <select value={step} onChange={(e) => setStep(e.target.value as TimeseriesStep)}>
                            <option value="day">День</option>
                            <option value="week">Неделя</option>
                            <option value="month">Месяц</option>
                        </select>
                    </label>
                </div>
                <hr />
                <p style={{ fontSize: 18 }}><b>Показатели</b> {isLoading && <span style={{ fontSize: 12 }}>загрузка…</span>}</p>
                {kpi ? <KpiTiles kpi={kpi} /> : !isLoading && <p style={{ fontSize: 14 }}>Нет данных</p>}
                <hr />
                <p style={{ fontSize: 18 }}><b>Динамика</b></p>
                <LineChart points={series} />
            </div>
        </>
    );
});

const KpiTiles = observer(function KpiTiles({ kpi }: { kpi: Kpi }) {
    const statusName = (id: string) => markStatusesStore.statuses.find((s) => String(s.mark_status_id) === id)?.name ?? `Статус ${id}`;
    const byStatus = Object.entries(kpi.by_status ?? {}).sort(([a], [b]) => Number(a) - Number(b));
    return (
        <>
            <div className="kpi-grid">
                <KpiTile value={kpi.total} label="Всего проблем" />
                <KpiTile value={kpi.open_older_than_30d} label="Открыты дольше 30 дней" />
                <KpiTile value={formatHours(kpi.avg_confirm_hours)} label="Среднее время подтверждения" />
                <KpiTile value={formatHours(kpi.median_confirm_hours)} label="Медиана подтверждения" />
                <KpiTile value={formatHours(kpi.avg_close_hours)} label="Среднее время решения" />
                <KpiTile value={formatShare(kpi.refuted_share)} label="Доля опровергнутых" />
            </div>
            {byStatus.length > 0 &&
                <div className="kpi-grid">
                    {byStatus.map(([id, count]) => <KpiTile key={id} value={count} label={statusName(id)} />)}
                </div>
            }
        </>
    );
});

function KpiTile({ value, label }: { value: number | string; label: string }) {
    return (
        <div className="kpi-grid__item">
            <b>{value}</b>
            <span>{label}</span>
        </div>
    );
}

/** Plain-SVG multi-series line chart (no chart libraries). */
export function LineChart({ points }: { points: TimeseriesPoint[] }) {
    const layout = DEFAULT_CHART_LAYOUT;
    const { width, height, padding } = layout;
    const series: ChartSeries[] = SERIES_META.map((meta) => ({
        ...meta,
        values: points.map((p) => p[meta.key] ?? 0),
    }));
    const rawMax = series.reduce((m, s) => Math.max(m, ...s.values), 0);
    const yMax = niceMax(rawMax);
    const ticks = yTicks(yMax);
    const innerH = height - padding.top - padding.bottom;
    const innerW = width - padding.left - padding.right;

    if (points.length === 0) {
        return <p style={{ fontSize: 14 }}>Нет данных за период</p>;
    }

    const labelEvery = Math.max(1, Math.ceil(points.length / 6));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="График динамики проблем" style={{ background: "white", border: "1px solid rgb(201, 201, 201)" }}>
                {ticks.map((t) => {
                    const y = padding.top + innerH - (innerH * t) / yMax;
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
                    const x = padding.left + (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1));
                    return (
                        <text key={p.period} x={x} y={height - 6} fontSize={8} textAnchor="middle" fill="#555">{periodLabel(p.period)}</text>
                    );
                })}
                {series.map((s) => (
                    <polyline key={s.key} points={linePoints(s.values, yMax, layout)} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
                ))}
            </svg>
            <div className="chart-legend">
                {series.map((s) => (
                    <div key={s.key} className="chart-legend__item">
                        <i style={{ backgroundColor: s.color }} />
                        {s.label}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Analytics;
