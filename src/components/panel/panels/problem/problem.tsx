import { Outlet, useParams } from "react-router-dom";
import { COLOR_MARK_STATUSES, TypeMarkIcons } from "../../../mark/mark";
import { createContext, useEffect, useRef, useState } from "react";
import MarksService, { Mark, MarkStatus, MarkType } from "../../../../services/MarksService";
import markTypesStore from "../../../../store/mark-types";
import markStatusesStore from "../../../../store/mark-statuses";
import { observer } from "mobx-react-lite";
import panelStore from "../../../../store/panel";

export const emptyMark: Mark = {
    mark_id: 0,
    name: "",
    geom: {
        type: "Point",
        coordinates: [0, 0]
    },
    mark_type_id: 1,
    user_id: 0,
    district_id: 0,
    mark_status_id: 0,
    created_at: "",
    updated_at: ""
}

export const MarkContext = createContext<Mark>(emptyMark)

const ProblemPanel = observer(() => {
    const params = useParams();

    const panelHeaderRef = useRef<HTMLDivElement>(null);

    const [mark, setMark] = useState<Mark>(emptyMark);

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

    let markStatus: MarkStatus = { mark_status_id: 0, parent_id: 0, name: "Статус" };
    if (markStatusesStore.statuses.length > 0 && mark.mark_status_id !== 0) {
        const findStatus = markStatusesStore.statuses.find((status) => status.mark_status_id == mark.mark_status_id);
        if (findStatus) {
            markStatus = findStatus;
        }
    }


    useEffect(() => {
        const markIdParam = Number(params.id);
        if (mark.mark_id === 0 || mark.mark_id !== markIdParam)
            MarksService.getMarkById(markIdParam)
                .then((data) => {
                    console.log(data.payload.mark);
                    setMark(data.payload.mark)
                })
                .catch((error) => {
                    console.log(error);
                })
    }, [params])

    return (
        <MarkContext.Provider value={mark}>
            <div
                ref={panelHeaderRef}
                className="panel__header"
                onClick={() => panelStore.toggle()}
            >
                <div className="panel__header__status">
                    <div style={{ border: `2px solid ${COLOR_MARK_STATUSES[markStatus?.mark_status_id!]}`, backgroundColor: "#fff", borderRadius: "4px", padding: "4px" }}>
                        <p style={{ color: "#000" }}><b>{markStatus?.name}</b></p>
                    </div>
                </div>
                <p style={{ fontSize: "12px" }}>№{mark.mark_id}</p>
                <p style={{ fontSize: 12 }}>Координаты: <b>{mark.geom.coordinates[1].toFixed(6)}, {mark.geom.coordinates[0].toFixed(6)}</b></p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {TypeMarkIcons[mark.mark_type_id]({ color: "#fff" })}
                    <p style={{ fontSize: 14 }}><b>{markType?.name}</b></p>
                </div>
            </div>
            <div className="panel__content">
                <Outlet />
            </div>
        </MarkContext.Provider>
    );
});

export default ProblemPanel;