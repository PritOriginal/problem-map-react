import { observer } from "mobx-react-lite";
import { SimilarMark } from "../../services/MarksService";
import markTypesStore from "../../store/mark-types";
import { StatusBadge } from "../badges/badges";
import { useT } from "../../i18n";
import { Button } from "../button/button";
import { formatDistance } from "../../utils/similar";

interface SimilarMarksBlockProps {
    marks: SimilarMark[];
    /** "It's this one": navigate to the chosen mark. */
    onPick: (mark: SimilarMark) => void;
    /** "Create anyway" (`?force=true`). */
    onForce: () => void;
    onCancel: () => void;
    pending?: boolean;
}

/** Warning shown when similar marks exist near the point being reported (or on 409 from `POST /marks`). */
const SimilarMarksBlock = observer(function SimilarMarksBlock({ marks, onPick, onForce, onCancel, pending = false }: SimilarMarksBlockProps) {
    const { t } = useT();
    return (
        <div className="similar-block" role="alertdialog" aria-label={t("similar.title")}>
            <p><b>{t("similar.title")}</b></p>
            <p style={{ fontSize: 13 }}>{t("similar.hint")}</p>
            <div className="similar-block__list">
                {marks.map((mark) => {
                    const type = markTypesStore.types.find((t) => t.mark_type_id === mark.mark_type_id);
                    const distance = formatDistance(mark.distance_m);
                    return (
                        <div key={mark.mark_id} className="similar-block__item">
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                                <p><b>{t("mark.n", { id: mark.mark_id })}</b> {type?.name ?? ""}{distance && ` · ${distance}`}</p>
                                <div style={{ alignSelf: "flex-start" }}><StatusBadge statusId={mark.mark_status_id} /></div>
                            </div>
                            <Button style="white-2-black" isMini onClick={() => onPick(mark)}>{t("similar.pick")}</Button>
                        </div>
                    );
                })}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <Button style="black-2-white" disabled={pending} onClick={onForce}>
                    {pending ? t("similar.forcing") : t("similar.force")}
                </Button>
                <Button style="white-2-black" disabled={pending} onClick={onCancel}>{t("common.cancel")}</Button>
            </div>
        </div>
    );
});

export default SimilarMarksBlock;
