import { useState } from "react";
import { observer } from "mobx-react-lite";
import { LngLat } from "@yandex/ymaps3-types";
import notificationsStore from "../../../../store/notifications";
import markTypesStore from "../../../../store/mark-types";
import MarksService, { Mark, SimilarMark } from "../../../../services/MarksService";
import { parseSimilarMarks, formatDistance } from "../../../../utils/similar";
import { Button } from "../../../button/button";
import { useAsyncData } from "../../../../utils/use-async-data";
import { useT } from "../../../../i18n";

/** "Merge into…": similar marks from `GET /marks/similar` plus a manual id -> `POST /marks/{id}/merge-into/{target}`. */
export const MergeForm = observer(function MergeForm({ mark, onCancel, onDone }: { mark: Mark; onCancel: () => void; onDone: (target: Mark) => void }) {
    const { t } = useT();
    const [manualId, setManualId] = useState("");
    const [pending, setPending] = useState(false);

    // A failed lookup leaves the manual id field, which is enough to merge; the banner
    // would say nothing the empty list does not.
    const { data: similar = [], isLoading: loading } = useAsyncData<SimilarMark[]>(
        (signal) => {
            const [lon, lat] = mark.geom.coordinates as LngLat;
            return MarksService
                .getSimilarMarks({ point: { longitude: lon, latitude: lat }, mark_type_id: mark.mark_type_id }, { signal })
                .then((res) => parseSimilarMarks(res.payload).filter((m) => m.mark_id !== mark.mark_id));
        },
        [mark],
        { silent: true },
    );

    const merge = (targetId: number) => {
        if (!Number.isInteger(targetId) || targetId <= 0 || targetId === mark.mark_id) {
            return;
        }
        if (!window.confirm(t("moderation.mergeQuestion", { id: mark.mark_id, target: targetId }))) {
            return;
        }
        setPending(true);
        MarksService.mergeMark(mark.mark_id, targetId)
            .then((data) => {
                notificationsStore.clear();
                onDone(data.payload ?? ({ mark_id: targetId } as Mark));
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("moderation.mergeFailed"));
            })
            .finally(() => setPending(false));
    };

    return (
        <div className="similar-block">
            <p><b>{t("moderation.mergeTitle", { id: mark.mark_id })}</b></p>
            {loading && <p className="empty-state">{t("moderation.similarLoading")}</p>}
            {!loading && similar.length === 0 && <p className="empty-state">{t("moderation.similarEmpty")}</p>}
            <div className="similar-block__list">
                {similar.map((s) => {
                    const type = markTypesStore.byId.get(s.mark_type_id);
                    const distance = formatDistance(s.distance_m);
                    return (
                        <div key={s.mark_id} className="similar-block__item">
                            <p><b>{t("mark.n", { id: s.mark_id })}</b> {type?.name ?? ""}{distance && ` · ${distance}`}</p>
                            <Button style="secondary" isMini disabled={pending} onClick={() => merge(s.mark_id)}>{t("moderation.mergeConfirm")}</Button>
                        </div>
                    );
                })}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                    type="number"
                    min={1}
                    placeholder={t("moderation.mergeManual")}
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    style={{ padding: "6px", fontSize: 13, width: "140px" }}
                    aria-label={t("moderation.mergeManual")}
                />
                <Button style="primary" isMini disabled={pending || manualId === ""} onClick={() => merge(Number(manualId))}>
                    {t(pending ? "moderation.merging" : "moderation.mergeConfirm")}
                </Button>
                <Button style="secondary" isMini disabled={pending} onClick={onCancel}>{t("common.cancel")}</Button>
            </div>
        </div>
    );
});
