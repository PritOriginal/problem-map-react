import { Outlet, useParams } from "react-router-dom";
import { TypeIcon } from "../../../mark/mark";
import { statusColors } from "../../../../styles/tokens";
import { contrastOn } from "../../../../utils/mark-types";
import { Suspense, useCallback, useEffect, useRef } from "react";
import MarksService, { Mark, MarkStatus, MarkType } from "../../../../services/MarksService";
import markTypesStore from "../../../../store/mark-types";
import markStatusesStore from "../../../../store/mark-statuses";
import { observer } from "mobx-react-lite";
import panelStore from "../../../../store/panel";
import selectedMark from "../../../../store/selected_mark";
import marksStore from "../../../../store/marks";
import { LngLat } from "@yandex/ymaps3-types";
import { MarkContext, MarkReloadContext, emptyMark } from "./mark-context";
import { useT } from "../../../../i18n";
import { useAsyncData } from "../../../../utils/use-async-data";
import { HiddenBadge, OrgLabel, SlaBadge } from "../../../badges/badges";


const ProblemPanel = observer(() => {
    const params = useParams();
    const { t } = useT();

    const panelHeaderRef = useRef<HTMLDivElement>(null);

    const markId = params.id;
    const { data, reload: reloadMark } = useAsyncData(
        (signal) => MarksService.getMarkById(Number(markId), { signal }).then((res) => {
            const loaded = res.payload.mark;
            selectedMark.setLoadedCoords(loaded.mark_id, loaded.geom.coordinates as LngLat);
            return loaded;
        }),
        [markId],
        { errorMessage: t("mark.loadFailed") },
    );
    const mark: Mark = data ?? emptyMark;

    // `reloadMark` re-reads the panel's own copy of the mark. The store call is only
    // about the pins on the map behind the panel -- an incremental sync moves the
    // one changed mark there instead of re-downloading every mark in the city.
    const reload = useCallback(() => {
        reloadMark();
        marksStore.sync();
    }, [reloadMark]);

    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight)
        }
    }, [mark]);

    let markType: MarkType = { mark_type_id: 0, name: "" };
    if (markTypesStore.types.length > 0 && mark.mark_type_id !== 0) {
        const findType = markTypesStore.byId.get(mark.mark_type_id);
        if (findType) {
            markType = findType
        }
    }

    let markStatus: MarkStatus = { mark_status_id: 0, parent_id: null, name: t("common.status") };
    if (markStatusesStore.statuses.length > 0 && mark.mark_status_id !== 0) {
        const findStatus = markStatusesStore.byId.get(mark.mark_status_id);
        if (findStatus) {
            markStatus = findStatus;
        }
    }


    // The header ground is `--chrome` in both themes, so the status takes the dark
    // scale in both: the light-theme values include a slate and two greys that are
    // invisible on it. `?? [1]` covers the moment before the dictionary has loaded.
    const statusColor = statusColors("dark")[markStatus.mark_status_id] ?? statusColors("dark")[1];

    return (
        <MarkContext.Provider value={mark}>
        <MarkReloadContext.Provider value={reload}>
            <div
                ref={panelHeaderRef}
                className="panel__header"
                onClick={() => panelStore.toggle()}
            >
                {/* Number and status first, the way a work order is headed: those
                    two are how a mark is named in moderation and in a conversation
                    about it, and both used to sit below the title -- the id tacked
                    onto the end of the coordinate line, unlabelled, and the status
                    drawn as an outline, which threw away the one thing that already
                    identifies it. The tag is FILLED with the status colour, so it is
                    the same colour as the pin on the map behind the panel and doubles
                    as that pin's legend.

                    The dark scale, in both themes: the header ground is `--chrome`
                    either way, and the light-theme values are a slate and two greys
                    that vanish on it. The ink is computed per colour rather than
                    fixed -- `#ffc93d` and `#6f7477` do not take the same one. */}
                <div className="panel__header__labels">
                    <span className="panel__header__ref">{t("mark.n", { id: mark.mark_id })}</span>
                    <span
                        className="status-tag"
                        style={{ backgroundColor: statusColor, color: contrastOn(statusColor) }}
                    >
                        {markStatus.name}
                    </span>
                    <HiddenBadge hidden={mark.hidden} />
                    <SlaBadge slaDueAt={mark.sla_due_at} isOverdue={mark.is_overdue} />
                    <OrgLabel organizationId={mark.organization_id} />
                </div>
                <div className="panel__header__rule" aria-hidden="true" />
                {/* Rows, not columns. A right-hand column only works while the title
                    is short enough to leave room for it, and category names come
                    from the backend: "Информационные и визуальные дефекты" pushed
                    the column onto its own line, where it collapsed to the width of
                    the status chip and hung the mark number under it. */}
                <h1 className="panel__header__title">
                    <TypeIcon typeId={mark.mark_type_id} type={markType.mark_type_id !== 0 ? markType : undefined} color="var(--on-chrome)" />
                    <span>{markType.name}</span>
                </h1>
                <p className="panel__header__coords">
                    <span className="visually-hidden">{t("common.coordinates")}: </span>
                    {mark.geom.coordinates[1].toFixed(6)}, {mark.geom.coordinates[0].toFixed(6)}
                </p>
            </div>
            <div className="panel__content">
                {/* Its own boundary: the children of /problem/:id are lazy too, and
                    a boundary only at the panel shell would drop this header while
                    add-check loads. */}
                <Suspense fallback={<p className="empty-state">{t("common.loading")}</p>}>
                    <Outlet />
                </Suspense>
            </div>
        </MarkReloadContext.Provider>
        </MarkContext.Provider>
    );
});

export default ProblemPanel;