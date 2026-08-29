import { useState } from "react";
import notificationsStore from "../../../../store/notifications";
import markTypesStore from "../../../../store/mark-types";
import AdminService, { AddMarkTypeRequest, AdminMarkType, UpdateMarkTypeRequest } from "../../../../services/AdminService";
import { isHexColor } from "../../../../utils/mark-types";
import { useAsyncData } from "../../../../utils/use-async-data";
import { Button } from "../../../button/button";
import { TranslationKey, useT } from "../../../../i18n";

// The colour here is DATA, not chrome: it is stored on the mark type and sent to
// the backend, and `<input type="color">` accepts only a literal hex. Both stay
// literals on purpose -- neither can be a token.
const EMPTY_TYPE: AddMarkTypeRequest = { code: "", name_ru: "", name_en: "", icon: "", color: "#e50000", sla_hours: 72 };

/** Types tab of `/admin`: the mark-type dictionary with an inline editor per row. */
export const MarkTypesTable = function MarkTypesTable() {
    const { t } = useT();
    const [adding, setAdding] = useState(false);

    const { data, isLoading, reload: reloadTypes } = useAsyncData(
        (signal) => AdminService.getMarkTypes({ signal }).then((res) => res.payload),
        [],
        { errorMessage: t("admin.types.loadFailed") },
    );
    const types: AdminMarkType[] = data ?? [];

    const reload = () => {
        reloadTypes();
        // the public dictionary (map markers / filters) follows the change: forced, since the
        // store keeps what it already loaded and would otherwise skip the request
        markTypesStore.fetch(true);
    };

    return (
        <div className="admin-form">
            {isLoading && types.length === 0 && <p className="empty-state">{t("common.loading")}</p>}
            <div className="profile-list">
                {types.map((type) => <MarkTypeRow key={type.mark_type_id} type={type} onDone={reload} />)}
            </div>
            {adding
                ? <MarkTypeEditor initial={EMPTY_TYPE} isNew onCancel={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />
                : <div><Button style="primary" onClick={() => setAdding(true)}>{t("admin.types.add")}</Button></div>
            }
        </div>
    );
};

function MarkTypeRow({ type, onDone }: { type: AdminMarkType; onDone: () => void }) {
    const { t } = useT();
    const [editing, setEditing] = useState(false);
    const [pending, setPending] = useState(false);

    const patch = (req: UpdateMarkTypeRequest) => {
        setPending(true);
        AdminService.updateMarkType(type.mark_type_id, req)
            .then(() => {
                notificationsStore.clear();
                onDone();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("admin.types.saveFailed"));
            })
            .finally(() => setPending(false));
    };

    if (editing) {
        return (
            <MarkTypeEditor
                initial={{ code: type.code, name_ru: type.name_ru, name_en: type.name_en, icon: type.icon, color: type.color, sla_hours: type.sla_hours }}
                sortOrder={type.sort_order}
                active={type.active}
                onCancel={() => setEditing(false)}
                onDone={() => { setEditing(false); onDone(); }}
                save={(req) => AdminService.updateMarkType(type.mark_type_id, req)}
            />
        );
    }

    return (
        <div className={`task-card admin-type ${type.active ? "" : "inactive"}`}>
            <div className="task-card__row">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <span className="admin-type__swatch" style={{ backgroundColor: type.color || "var(--swatch-empty)" }} aria-hidden="true">{type.icon}</span>
                    <p style={{ fontSize: 14 }}><b>{type.name_ru || type.name}</b> {type.name_en && <span style={{ color: "var(--ink-muted)" }}>/ {type.name_en}</span>}</p>
                </div>
                <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>#{type.mark_type_id} · {type.code}</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                {t("admin.types.sla")}: {type.sla_hours} · {t("admin.types.sortOrder")}: {type.sort_order} · {t("admin.types.active")}: {type.active ? "✓" : "✗"}
            </p>
            <div className="task-card__actions">
                <Button style="secondary" isMini disabled={pending} onClick={() => setEditing(true)}>{t("common.edit")}</Button>
                <Button style={type.active ? "negative" : "positive"} isMini disabled={pending} onClick={() => patch({ active: !type.active })}>
                    {type.active ? "✗" : "✓"} {t("admin.types.active")}
                </Button>
                <Button style="secondary" isMini disabled={pending} onClick={() => patch({ sort_order: type.sort_order - 1 })} aria-label="↑">↑</Button>
                <Button style="secondary" isMini disabled={pending} onClick={() => patch({ sort_order: type.sort_order + 1 })} aria-label="↓">↓</Button>
            </div>
        </div>
    );
}

interface MarkTypeEditorProps {
    initial: AddMarkTypeRequest;
    isNew?: boolean;
    sortOrder?: number;
    active?: boolean;
    onCancel: () => void;
    onDone: () => void;
    save?: (req: UpdateMarkTypeRequest) => Promise<unknown>;
}

function MarkTypeEditor({ initial, isNew = false, sortOrder = 0, active = true, onCancel, onDone, save }: MarkTypeEditorProps) {
    const { t } = useT();
    const [form, setForm] = useState<AddMarkTypeRequest & { sort_order: number; active: boolean }>({ ...initial, sort_order: sortOrder, active });
    const [pending, setPending] = useState(false);

    const colorOk = isHexColor(form.color);
    const valid = form.code.trim() !== "" && form.name_ru.trim() !== "" && colorOk && Number.isInteger(form.sla_hours) && form.sla_hours >= 0;

    const submit = () => {
        if (!valid) {
            notificationsStore.showError(null, t("admin.invalid"));
            return;
        }
        setPending(true);
        const req: AddMarkTypeRequest = { code: form.code.trim(), name_ru: form.name_ru.trim(), name_en: form.name_en.trim(), icon: form.icon.trim(), color: form.color.trim(), sla_hours: form.sla_hours };
        const call = isNew ? AdminService.addMarkType(req) : (save ?? (() => Promise.resolve()))({ ...req, sort_order: form.sort_order, active: form.active });
        call
            .then(() => {
                notificationsStore.clear();
                onDone();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("admin.types.saveFailed"));
            })
            .finally(() => setPending(false));
    };

    const field = (key: keyof AddMarkTypeRequest, label: TranslationKey, type: "text" | "number" = "text", extra?: React.ReactNode) => (
        <label className="admin-field">
            <span>{t(label)}</span>
            <input
                type={type}
                value={String(form[key])}
                disabled={pending || (key === "code" && !isNew)}
                onChange={(e) => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
            />
            {extra}
        </label>
    );

    return (
        <div className="task-card admin-form">
            <div className="admin-grid">
                {field("code", "admin.types.code")}
                {field("sla_hours", "admin.types.sla", "number")}
                {field("name_ru", "admin.types.nameRu")}
                {field("name_en", "admin.types.nameEn")}
                {field("icon", "admin.types.icon")}
                <label className={`admin-field ${colorOk ? "" : "invalid"}`}>
                    <span>{t("admin.types.color")}</span>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <input type="color" value={colorOk && form.color.length === 7 ? form.color : "#000000"} disabled={pending} onChange={(e) => setForm({ ...form, color: e.target.value })} aria-label={t("admin.types.color")} />
                        <input type="text" value={form.color} disabled={pending} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ flex: 1 }} />
                    </div>
                    {!colorOk && <small>{t("admin.types.colorInvalid")}</small>}
                </label>
                {!isNew &&
                    <>
                        <label className="admin-field">
                            <span>{t("admin.types.sortOrder")}</span>
                            <input type="number" value={form.sort_order} disabled={pending} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
                        </label>
                        <label className="admin-field admin-field--check">
                            <input type="checkbox" checked={form.active} disabled={pending} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                            <span>{t("admin.types.active")}</span>
                        </label>
                    </>
                }
            </div>
            <div className="task-card__actions">
                <Button style="positive" isMini disabled={pending || !valid} onClick={submit}>{t(pending ? "common.saving" : "common.save")}</Button>
                <Button style="secondary" isMini disabled={pending} onClick={onCancel}>{t("common.cancel")}</Button>
            </div>
        </div>
    );
}

export default MarkTypesTable;
