import { useContext, useState } from "react";
import Select from "react-select";
import { observer } from "mobx-react-lite";
import MarksService, { MarkType } from "../../../../../services/MarksService";
import { useT } from "../../../../../i18n";
import { useNavigateKeepSearch } from "../../../../../utils/navigation";
import markTypesStore from "../../../../../store/mark-types";
import marksStore from "../../../../../store/marks";
import notificationsStore from "../../../../../store/notifications";
import { Button } from "../../../../button/button";
import { MarkContext } from "../mark-context";

/** Owner-only actions for an unconfirmed mark: edit description/type, delete. */
export const OwnerBlock = observer(function OwnerBlock({ onDone }: { onDone: () => void }) {
    const mark = useContext(MarkContext);
    const navigate = useNavigateKeepSearch();
    const { t } = useT();
    const [editing, setEditing] = useState(false);
    const [description, setDescription] = useState(mark.description);
    const [typeId, setTypeId] = useState(mark.mark_type_id);
    const [pending, setPending] = useState<"save" | "delete" | null>(null);

    const startEdit = () => {
        setDescription(mark.description);
        setTypeId(mark.mark_type_id);
        setEditing(true);
    };

    const save = () => {
        const req: { description?: string; mark_type_id?: number } = {};
        if (description !== mark.description) {
            req.description = description;
        }
        if (typeId !== mark.mark_type_id) {
            req.mark_type_id = typeId;
        }
        if (Object.keys(req).length === 0) {
            setEditing(false);
            return;
        }
        setPending("save");
        MarksService.updateMark(mark.mark_id, req)
            .then(() => {
                notificationsStore.clear();
                setEditing(false);
                onDone();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("mark.saveFailed"));
            })
            .finally(() => setPending(null));
    };

    const remove = () => {
        if (!window.confirm(t("mark.deleteQuestion", { id: mark.mark_id }))) {
            return;
        }
        setPending("delete");
        MarksService.deleteMark(mark.mark_id)
            .then(() => {
                notificationsStore.clear();
                marksStore.sync();
                navigate("/");
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("mark.deleteFailed"));
                setPending(null);
            });
    };

    const options = markTypesStore.types.map((type: MarkType) => ({ value: type.mark_type_id, label: type.name }));

    return (
        <>
            <h2 className="section-title">{t("mark.mine")}</h2>
            {editing ?
                <>
                    <p><b>{t("common.category")}</b></p>
                    <Select
                        options={options}
                        value={options.find((o) => o.value === typeId) ?? null}
                        onChange={(val) => { if (val) { setTypeId(val.value); } }}
                        isDisabled={options.length === 0}
                    />
                    <p><b>{t("common.description")}</b></p>
                    <textarea
                        className="edit-multiline-text"
                        name="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    ></textarea>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <Button style="positive" disabled={pending !== null} onClick={save}>
                            {t(pending === "save" ? "common.saving" : "common.save")}
                        </Button>
                        <Button style="secondary" disabled={pending !== null} onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
                    </div>
                </>
                :
                <div style={{ display: "flex", gap: "8px" }}>
                    <Button style="secondary" disabled={pending !== null} onClick={startEdit}>{t("common.edit")}</Button>
                    <Button style="negative" disabled={pending !== null} onClick={remove}>
                        {t(pending === "delete" ? "common.deleting" : "common.delete")}
                    </Button>
                </div>
            }
            <hr />
        </>
    );
});
