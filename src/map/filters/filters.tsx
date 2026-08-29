import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";

import { useT } from "../../i18n";
import { useTheme } from "../../theme";
import { MARKER_ICON, statusColors, STATUS_FALLBACK } from "../../styles/tokens";
import { TypeIcon } from "../../components/mark/mark";
import { typeColor } from "../../utils/mark-types";
import { filtersEqual } from "../../utils/filters";
import { HEAT_COLORS } from "../../utils/heatmap";
import marksStore, { DEFAULT_FILTERS } from "../../store/marks";
import markStatusesStore from "../../store/mark-statuses";
import markTypesStore from "../../store/mark-types";
import adminBoundariesStore from "../../store/admin-boundaries";
import heatmapStore from "../../store/heatmap";
import tasksStore from "../../store/tasks";
import user from "../../store/user";
import { FILTERS_CLOSE_MS, FILTERS_OPEN_MS } from "../map-constants";
import ExportLink from "../controls/export-link";

import FilterIcon from "../../assets/filter.svg?react";
import "../../components/filters/filters.scss";

/**
 * The map filter panel.
 *
 * Two lists, two controls, because the two lists come from different places.
 * Mark statuses are a fixed dictionary of eight short names -- toggle chips, lit
 * in their own status colour, so the panel doubles as the map's legend. Category
 * names arrive from the backend at a length we do not control, so they stay rows
 * that may wrap. Above both sit the two display MODES, which repaint the whole
 * map rather than narrow the selection and no longer share a list with the filters.
 *
 * An empty list means "no restriction" to the API (`MarksService.marksQuery`
 * omits the param), so a zero count is spelled out as "all" -- a bare 0 reads as
 * "nothing shown", which is its opposite.
 */
const Filters = observer(() => {
    const { t } = useT();
    const { resolved } = useTheme();
    const statuses = statusColors(resolved);
    const [showFilters, setShowFilters] = useState(false);
    // The panel does not appear beside the round button, it IS the button: it is
    // clipped back to a 56px circle at the button's exact position and unclipped
    // outward. The button stays mounted across the morph and crossfades, so the
    // white disc and the dark bar occupy the same circle at the same moment rather
    // than one blinking out and the other in.
    //
    // Both phases are driven by timers rather than by `animationend`: that event is
    // not guaranteed to arrive -- it never fires under reduced motion, and a
    // headless Chrome dropped it even at full duration -- and its failure mode here
    // would be a panel that can never be closed again. A timer always fires.
    const [phase, setPhase] = useState<"open" | "close" | null>(null);
    const timer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(timer.current), []);

    const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const open = () => {
        window.clearTimeout(timer.current);
        setShowFilters(true);
        if (reducedMotion()) {
            setPhase(null);
            return;
        }
        setPhase("open");
        timer.current = window.setTimeout(() => setPhase(null), FILTERS_OPEN_MS);
    };

    const close = () => {
        window.clearTimeout(timer.current);
        if (reducedMotion()) {
            setPhase(null);
            setShowFilters(false);
            return;
        }
        setPhase("close");
        timer.current = window.setTimeout(() => {
            setPhase(null);
            setShowFilters(false);
        }, FILTERS_CLOSE_MS);
    };

    const statusIds = marksStore.filters.mark_status_ids;
    const typeIds = marksStore.filters.mark_type_ids;
    const selected = statusIds.length + typeIds.length;
    const total = markStatusesStore.statuses.length + markTypesStore.types.length;
    const isDefault = filtersEqual(marksStore.filters, DEFAULT_FILTERS);

    const count = (selected: number, total: number) =>
        selected === 0 ? t("map.filtersAll") : t("map.filtersCount", { n: selected, total });

    return (
        <>
            {(!showFilters || phase !== null) &&
                <button
                    type="button"
                    className={`circle-button filters-button${phase ? ` filters-button--${phase}` : ""}`}
                    title={t("map.filters")}
                    aria-label={t("map.filtersTitle")}
                    onClick={open}
                >
                    <span className="circle-button__content">
                        <FilterIcon style={{ transform: "translate(0, 2px)" }} />
                    </span>
                </button>
            }

            {showFilters &&
                <div className={`filters${phase ? ` filters--${phase}` : ""}`}>
                    <div className="filters__bar">
                        {/* The round button does not sit beside the panel, it becomes it: the
                            panel opens at the button's own position and the glyph moves into
                            the bar, where it closes the panel again. */}
                        <button
                            type="button"
                            className="filters__toggle"
                            aria-expanded={showFilters}
                            aria-label={t("map.filtersTitle")}
                            onClick={close}
                        >
                            <FilterIcon />
                        </button>
                        <h2>{t("map.filters")}</h2>
                        <span className="filters__count">{count(selected, total)}</span>
                        {!isDefault &&
                            <button type="button" className="filters__reset" onClick={() => marksStore.setFilters(DEFAULT_FILTERS)}>
                                {t("map.filtersReset")}
                            </button>
                        }
                    </div>

                    <div className="filters__body">
                        <div>
                            <FilterMode
                                swatch={<i className="filter-mode__swatch" style={{ background: `linear-gradient(90deg, ${HEAT_COLORS[0]}, ${HEAT_COLORS[HEAT_COLORS.length - 1]})` }} />}
                                name={t("map.heatmap")}
                                checked={heatmapStore.enabled}
                                onClick={() => heatmapStore.toggle()}
                            />
                            {user.id !== 0 &&
                                <FilterMode
                                    swatch={<i className="filter-mode__swatch filter-mode__swatch--mine" />}
                                    name={t("map.myTasks")}
                                    checked={tasksStore.onlyMine}
                                    onClick={() => tasksStore.toggleOnlyMine()}
                                />
                            }
                        </div>

                        <section className="filters__group">
                            <h3>{t("map.statuses")}<em className="filters__group-count">{count(statusIds.length, markStatusesStore.statuses.length)}</em></h3>
                            <div className="filter-chips">
                                {markStatusesStore.statuses.map((status) => (
                                    <button
                                        key={status.mark_status_id}
                                        type="button"
                                        className="filter-chip"
                                        aria-pressed={statusIds.includes(status.mark_status_id)}
                                        style={{ "--chip-color": statuses[status.mark_status_id] ?? STATUS_FALLBACK } as CSSProperties}
                                        onClick={() => marksStore.updateMarkStatus(status.mark_status_id)}
                                    >
                                        <i className="filter-chip__dot" />
                                        {status.name}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="filters__group">
                            <h3>{t("map.categories")}<em className="filters__group-count">{count(typeIds.length, markTypesStore.types.length)}</em></h3>
                            <div className="filter-rows">
                                {markTypesStore.types.map((type) => (
                                    <button
                                        key={type.mark_type_id}
                                        type="button"
                                        className="filter-row"
                                        aria-pressed={typeIds.includes(type.mark_type_id)}
                                        onClick={() => {
                                            marksStore.updateMarkType(type.mark_type_id);
                                            adminBoundariesStore.fetchMarksCount();
                                        }}
                                    >
                                        <span
                                            className={`filter-row__glyph${typeColor(type) ? " icon-on-fill" : ""}`}
                                            style={typeColor(type) ? { backgroundColor: typeColor(type) } : undefined}
                                        >
                                            <TypeIcon typeId={type.mark_type_id} type={type} color={typeColor(type) ? MARKER_ICON : "var(--ink)"} />
                                        </span>
                                        <span className="filter-row__name">{type.name}</span>
                                        <i className="filter-row__tick" />
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="filters__foot" title={t("map.exportHint")}>
                        <span>{t("map.export")}</span>
                        <ExportLink format="geojson">{t("map.exportGeojson")}</ExportLink>
                        <ExportLink format="csv">{t("map.exportCsv")}</ExportLink>
                    </div>
                </div>
            }
        </>
    );
});

/** A display mode: it repaints the whole map, so it is a switch, not a checkbox. */
function FilterMode({ swatch, name, checked, onClick }: { swatch: ReactNode, name: string, checked: boolean, onClick: () => void }) {
    return (
        <button type="button" className="filter-mode" aria-pressed={checked} onClick={onClick}>
            <span className="filter-mode__switch" />
            {swatch}
            <span className="filter-mode__name">{name}</span>
        </button>
    );
}

export default Filters;
