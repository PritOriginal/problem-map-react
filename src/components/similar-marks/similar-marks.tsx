import { observer } from "mobx-react-lite";
import { SimilarMark } from "../../services/MarksService";
import markStatusesStore from "../../store/mark-statuses";
import markTypesStore from "../../store/mark-types";
import { COLOR_MARK_STATUSES } from "../mark/mark";
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
    return (
        <div className="similar-block" role="alertdialog" aria-label="Рядом уже есть похожая проблема">
            <p><b>Рядом уже есть похожая проблема</b></p>
            <p style={{ fontSize: 13 }}>Возможно, вы хотите отметить одну из них. Нажмите «Это она», чтобы перейти, или создайте новую.</p>
            <div className="similar-block__list">
                {marks.map((mark) => {
                    const status = markStatusesStore.statuses.find((s) => s.mark_status_id === mark.mark_status_id);
                    const type = markTypesStore.types.find((t) => t.mark_type_id === mark.mark_type_id);
                    const distance = formatDistance(mark.distance_m);
                    return (
                        <div key={mark.mark_id} className="similar-block__item">
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                                <p><b>№{mark.mark_id}</b> {type?.name ?? ""}{distance && ` · ${distance}`}</p>
                                <span className="profile-list__status" style={{ borderColor: COLOR_MARK_STATUSES[mark.mark_status_id] ?? "#000", alignSelf: "flex-start" }}>
                                    {status?.name ?? `Статус ${mark.mark_status_id}`}
                                </span>
                            </div>
                            <Button style="white-2-black" isMini onClick={() => onPick(mark)}>Это она</Button>
                        </div>
                    );
                })}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <Button style="black-2-white" disabled={pending} onClick={onForce}>
                    {pending ? "Отмечаем…" : "Всё равно создать"}
                </Button>
                <Button style="white-2-black" disabled={pending} onClick={onCancel}>Отмена</Button>
            </div>
        </div>
    );
});

export default SimilarMarksBlock;
