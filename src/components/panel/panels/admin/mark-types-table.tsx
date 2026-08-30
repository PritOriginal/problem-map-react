import { useState } from "react";
import notificationsStore from "../../../../store/notifications";
import markTypesStore from "../../../../store/mark-types";
import AdminService, { AddMarkTypeRequest, AdminMarkType, UpdateMarkTypeRequest } from "../../../../services/AdminService";
import { contrastOn, isHexColor } from "../../../../utils/mark-types";
import { useAsyncData } from "../../../../utils/use-async-data";
import { Button } from "../../../button/button";
import { TranslationKey, useT } from "../../../../i18n";

// The colour here is DATA, not chrome: it is stored on the mark type and sent to
// the backend, and it has to be the same value in both themes because it is the
// same pin on the map. Both stay literals on purpose -- neither can be a token.
const EMPTY_TYPE: AddMarkTypeRequest = { code: "", name_ru: "", name_en: "", icon: "", color: "#e50000", sla_hours: 72 };

/**
 * The colours offered when picking one for a type.
 *
 * A palette rather than the system colour picker: `<input type="color">` opens an
 * OS dialog with sixteen million choices, which is how a dictionary ends up with
 * five types in five near-identical greys. These six are spread across the wheel
 * and are the same values the status scale uses, so a type is legible on the
 * desaturated basemap. The hex field stays for anything else.
 */
const TYPE_PALETTE = ["#d92b2b", "#f07316", "#f4b71a", "#2fa55a", "#3d7fb5", "#8b5e3c"] as const;

/** Types tab of `/admin`: the mark-type dictionary with an inline editor per row. */
export const MarkTypesTable = function MarkTypesTable() {
    const { t } = useT();
    const [adding, setAdding] = useState(false);
    // Reordering is a mode, not four buttons on every row. The arrows were the same
    // size and weight as "Редактировать" on all five rows, and they are used about
    // once a year -- when a type is added.
    const [reordering, setReordering] = useState(false);

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
            {/* A dictionary of five entries, as a list of five rows. It was five
                96px cards, of which the tallest part was a line reading
                "SLA, ч: 72 · Порядок: 0 · Активен: ✓" -- three key-value pairs in
                a row, which reads as a log line, not as a reference table. */}
            <div className="type-list">
                {types.map((type) => <MarkTypeRow key={type.mark_type_id} type={type} reordering={reordering} onDone={reload} />)}
            </div>
            {adding
                ? <MarkTypeEditor initial={EMPTY_TYPE} isNew onCancel={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />
                : <div className="type-list__acts">
                    <Button style="primary" onClick={() => setAdding(true)}>{t("admin.types.add")}</Button>
                    {types.length > 1 &&
                        <Button style="secondary" onClick={() => setReordering(!reordering)}>
                            {t(reordering ? "admin.types.reorderDone" : "admin.types.reorder")}
                        </Button>
                    }
                </div>
            }
        </div>
    );
};

function MarkTypeRow({ type, reordering, onDone }: { type: AdminMarkType; reordering: boolean; onDone: () => void }) {
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

    const color = type.color?.trim();

    return (
        <div className={`type-row ${type.active ? "" : "type-row--off"}`}>
            {/* An unset colour is hatched, not grey: the grey circle the row used to
                draw could not be told apart from a type whose colour really is grey. */}
            <span
                className={`type-row__swatch ${color ? "" : "type-row__swatch--none"}`}
                style={color ? { backgroundColor: color, color: contrastOn(color) } : undefined}
                aria-hidden="true"
            >
                {type.icon}
            </span>
            <span className="type-row__name">
                <b>{type.name_ru || type.name}{type.name_en && <s> / {type.name_en}</s>}</b>
                <span>#{type.mark_type_id} · {type.code}</span>
            </span>
            {reordering
                ? <span className="type-row__side">
                    <button type="button" className="type-row__arrow" disabled={pending} onClick={() => patch({ sort_order: type.sort_order - 1 })} aria-label={t("admin.types.moveUp")}>↑</button>
                    <button type="button" className="type-row__arrow" disabled={pending} onClick={() => patch({ sort_order: type.sort_order + 1 })} aria-label={t("admin.types.moveDown")}>↓</button>
                </span>
                : <span className="type-row__side">
                    {/* "Активен" is no longer written out on every active row: being
                        active is the normal case, so only the exception is labelled. */}
                    {type.active
                        ? <span className="type-row__sla">{t("admin.types.slaShort", { hours: type.sla_hours })}</span>
                        : <span className="type-row__off">{t("admin.types.disabled")}</span>
                    }
                    <button type="button" className="type-row__edit" onClick={() => setEditing(true)}>{t("common.edit")}</button>
                </span>
            }
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
    // "Цвет в формате #rrggbb" used to be on screen in red before anything had been
    // typed: a new type opens with an empty field, and an empty field is not yet wrong.
    const [colorTouched, setColorTouched] = useState(false);

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

    const field = (key: keyof AddMarkTypeRequest, label: TranslationKey, type: "text" | "number" = "text") => (
        <label className="admin-field">
            <span>{t(label)}</span>
            <input
                type={type}
                value={String(form[key])}
                disabled={pending}
                onChange={(e) => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
            />
        </label>
    );

    return (
        <div className="type-editor">
            {/* The mark as it will be drawn on the map, above the fields that make
                it. Colour and icon were two text inputs and a system colour swatch,
                and nothing on the screen showed what they produced -- which is the
                only reason those two fields are filled in at all. */}
            <div className="type-preview">
                <span className="type-preview__pin" style={{ backgroundColor: colorOk ? form.color : "var(--swatch-empty)" }}>
                    <span style={{ color: colorOk ? contrastOn(form.color) : "var(--ink-muted)" }}>{form.icon}</span>
                </span>
                <span className="type-preview__text">
                    <b>{form.name_ru || t("admin.types.untitled")}</b>
                    <span>{form.code || "—"} · {t("admin.types.slaShort", { hours: form.sla_hours })}</span>
                </span>
            </div>
            <div className="admin-grid">
                {field("name_ru", "admin.types.nameRu")}
                {field("name_en", "admin.types.nameEn")}
                {field("icon", "admin.types.icon")}
                {field("sla_hours", "admin.types.sla", "number")}
            </div>
            <div className={`admin-field ${colorTouched && !colorOk ? "invalid" : ""}`}>
                <span>{t("admin.types.color")}</span>
                <div className="type-palette">
                    {TYPE_PALETTE.map((color) => (
                        <button
                            key={color}
                            type="button"
                            style={{ backgroundColor: color }}
                            aria-label={color}
                            aria-pressed={form.color.toLowerCase() === color}
                            disabled={pending}
                            onClick={() => { setColorTouched(true); setForm({ ...form, color }); }}
                        />
                    ))}
                    <input
                        className="type-palette__hex"
                        value={form.color}
                        disabled={pending}
                        aria-label={t("admin.types.color")}
                        onChange={(e) => { setColorTouched(true); setForm({ ...form, color: e.target.value }); }}
                    />
                </div>
                {colorTouched && !colorOk && <small>{t("admin.types.colorInvalid")}</small>}
            </div>
            <hr />
            {/* The code is the type's identity on the backend. It used to be a
                disabled input, which looks like a field that failed to load rather
                than one that is settled; on an existing type it is now a statement,
                and on a new one it is the only place it can ever be entered. */}
            {isNew
                ? field("code", "admin.types.code")
                : <div className="admin-field">
                    <span>{t("admin.types.code")}</span>
                    <p className="type-locked">{form.code} <s>{t("admin.types.codeLocked")}</s></p>
                </div>
            }
            {!isNew &&
                <div className="admin-grid">
                    <label className="admin-field">
                        <span>{t("admin.types.sortOrder")}</span>
                        <input type="number" value={form.sort_order} disabled={pending} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
                    </label>
                    <label className="admin-field admin-field--check">
                        <input type="checkbox" checked={form.active} disabled={pending} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                        <span>{t("admin.types.visible")}</span>
                    </label>
                </div>
            }
            <div className="task-card__actions">
                <Button style="positive" isMini disabled={pending || !valid} onClick={submit}>{t(pending ? "common.saving" : "common.save")}</Button>
                <Button style="secondary" isMini disabled={pending} onClick={onCancel}>{t("common.cancel")}</Button>
            </div>
        </div>
    );
}

export default MarkTypesTable;
