import { Outlet, useParams } from "react-router-dom";
import { TypeIcon } from "../../../mark/mark";
import { statusColors } from "../../../../styles/tokens";
import { useTheme } from "../../../../theme";
import { useCallback, useEffect, useRef, useState } from "react";
import MarksService, { Mark, MarkStatus, MarkType } from "../../../../services/MarksService";
import markTypesStore from "../../../../store/mark-types";
import markStatusesStore from "../../../../store/mark-statuses";
import { observer } from "mobx-react-lite";
import panelStore from "../../../../store/panel";
import notificationsStore from "../../../../store/notifications";
import selectedMark from "../../../../store/selected_mark";
import marksStore from "../../../../store/marks";
import { LngLat } from "@yandex/ymaps3-types";
import { MarkContext, MarkReloadContext, emptyMark } from "./mark-context";
import { useT } from "../../../../i18n";
import { HiddenBadge, OrgLabel, SlaBadge } from "../../../badges/badges";


const ProblemPanel = observer(() => {
    const { resolved } = useTheme();
    const params = useParams();
    const { t } = useT();

    const panelHeaderRef = useRef<HTMLDivElement>(null);

    const [mark, setMark] = useState<Mark>(emptyMark);
    const [version, setVersion] = useState(0);
    const reload = useCallback(() => {
        setVersion((v) => v + 1);
        marksStore.fetch();
    }, []);

    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight)
        }
    }, [mark]);

    let markType: MarkType = { mark_type_id: 0, name: "" };
    if (markTypesStore.types.length > 0 && mark.mark_type_id !== 0) {
        const findType = markTypesStore.types.find((type) => type.mark_type_id == mark.mark_type_id);
        if (findType) {
            markType = findType
        }
    }

    let markStatus: MarkStatus = { mark_status_id: 0, parent_id: null, name: t("common.status") };
    if (markStatusesStore.statuses.length > 0 && mark.mark_status_id !== 0) {
        const findStatus = markStatusesStore.statuses.find((status) => status.mark_status_id == mark.mark_status_id);
        if (findStatus) {
            markStatus = findStatus;
        }
    }


    useEffect(() => {
        let ignore = false;
        MarksService.getMarkById(Number(params.id))
            .then((data) => {
                if (!ignore) {
                    const loaded = data.payload.mark;
                    setMark(loaded);
                    selectedMark.setLoadedCoords(loaded.mark_id, loaded.geom.coordinates as LngLat);
                }
            })
            .catch((error) => {
                if (ignore) {
                    return;
                }
                console.error(error);
                notificationsStore.showError(error, t("mark.loadFailed"));
            });
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id, version])

    return (
        <MarkContext.Provider value={mark}>
        <MarkReloadContext.Provider value={reload}>
            <div
                ref={panelHeaderRef}
                className="panel__header"
                onClick={() => panelStore.toggle()}
            >
                <div className="panel__header__status">
                    <div className="status-chip" style={{ borderColor: statusColors(resolved)[markStatus.mark_status_id] }}>
                        {markStatus.name}
                    </div>
                </div>
                <p className="panel__header__id">{t("mark.n", { id: mark.mark_id })}</p>
                <p className="panel__header__coords">
                    <span className="visually-hidden">{t("common.coordinates")}: </span>
                    {mark.geom.coordinates[1].toFixed(6)}, {mark.geom.coordinates[0].toFixed(6)}
                </p>
                <div className="panel__header__type">
                    <TypeIcon typeId={mark.mark_type_id} type={markType.mark_type_id !== 0 ? markType : undefined} color="var(--on-chrome)" />
                    <p>{markType.name}</p>
                </div>
                {(mark.sla_due_at || mark.organization_id || mark.hidden) &&
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                        <HiddenBadge hidden={mark.hidden} />
                        <SlaBadge slaDueAt={mark.sla_due_at} isOverdue={mark.is_overdue} />
                        <OrgLabel organizationId={mark.organization_id} />
                    </div>
                }
            </div>
            <div className="panel__content">
                <Outlet />
            </div>
        </MarkReloadContext.Provider>
        </MarkContext.Provider>
    );
});

export default ProblemPanel;