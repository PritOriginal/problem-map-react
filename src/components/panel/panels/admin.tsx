import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import panelStore from "../../../store/panel";
import user from "../../../store/user";
import notificationsStore from "../../../store/notifications";
import markTypesStore from "../../../store/mark-types";
import AdminService, { AddMarkTypeRequest, AdminMarkType, AdminSettings, ApiKey, CreatedApiKey, UpdateMarkTypeRequest } from "../../../services/AdminService";
import { SETTINGS_FIELDS, getPath, normalizeSettings, setPath, validateSettings } from "../../../utils/admin-settings";
import { isHexColor } from "../../../utils/mark-types";
import { Button } from "../../button/button";
import { TranslationKey, localeOf, useT } from "../../../i18n";
import "../../badges/badges.scss";
import "./admin.scss";

type TabKey = "settings" | "types" | "keys";

const TABS: { key: TabKey; label: TranslationKey }[] = [
    { key: "settings", label: "admin.tab.settings" },
    { key: "types", label: "admin.tab.types" },
    { key: "keys", label: "admin.tab.keys" },
];

/** `/admin`: settings, problem types and API keys (role admin, backend integration/wave-5). */
const AdminPanel = observer(function AdminPanel() {
    const { t } = useT();
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight);
            panelStore.setOpen(true);
        }
    }, []);
    const [tab, setTab] = useState<TabKey>("settings");
    const isAdmin = user.id !== 0 && user.role === "admin";

    return (
        <>
            <div ref={panelHeaderRef} className="panel__header" onClick={() => panelStore.toggle()}>
                <p><b>{t("admin.title")}</b></p>
                <p style={{ fontSize: 12 }}>{t("admin.subtitle")}</p>
            </div>
            <div className="panel__content">
                {!isAdmin ?
                    <p style={{ fontSize: 14 }}>{t("admin.unavailable")}</p>
                    :
                    <>
                        <div className="tabs" role="tablist">
                            {TABS.map((item) => (
                                <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} className={`tabs__item ${tab === item.key ? "active" : ""}`} onClick={() => setTab(item.key)}>
                                    {t(item.label)}
                                </button>
                            ))}
                        </div>
                        {tab === "settings" && <SettingsForm />}
                        {tab === "types" && <MarkTypesTable />}
                        {tab === "keys" && <ApiKeysBlock />}
                    </>
                }
            </div>
        </>
    );
});

export default AdminPanel;

const SettingsForm = function SettingsForm() {
    const { t } = useT();
    const [saved, setSaved] = useState<AdminSettings | null>(null);
    const [form, setForm] = useState<AdminSettings | null>(null);
    const [pending, setPending] = useState(false);
    const [ok, setOk] = useState(false);

    useEffect(() => {
        let ignore = false;
        AdminService.getSettings()
            .then((data) => {
                if (!ignore) {
                    const s = normalizeSettings(data.payload);
                    setSaved(s);
                    setForm(s);
                }
            })
            .catch((error) => {
                if (ignore) {
                    return;
                }
                console.error(error);
                notificationsStore.showError(error, t("admin.settingsLoadFailed"));
            });
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!form || !saved) {
        return <p style={{ fontSize: 14 }}>{t("common.loading")}</p>;
    }

    const errors = validateSettings(form);
    const dirty = JSON.stringify(form) !== JSON.stringify(saved);

    const save = () => {
        if (Object.keys(errors).length > 0) {
            notificationsStore.showError(null, t("admin.invalid"));
            return;
        }
        setPending(true);
        AdminService.updateSettings(form)
            .then((data) => {
                notificationsStore.clear();
                const s = normalizeSettings(data.payload ?? form);
                setSaved(s);
                setForm(s);
                setOk(true);
                window.setTimeout(() => setOk(false), 2500);
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("admin.settingsSaveFailed"));
            })
            .finally(() => setPending(false));
    };

    const numberField = (path: string) => {
        const field = SETTINGS_FIELDS.find((f) => f.path === path)!;
        const error = errors[path];
        return (
            <label key={path} className={`admin-field ${error ? "invalid" : ""}`}>
                <span>{t(`admin.settings.${path}` as TranslationKey)}</span>
                <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.integer ? 1 : 0.01}
                    value={String(getPath(form, path) ?? "")}
                    onChange={(e) => setForm(setPath(form, path, e.target.value === "" ? NaN : Number(e.target.value)))}
                />
                <small>{t("admin.range", { min: field.min, max: field.max })}</small>
            </label>
        );
    };

    return (
        <div className="admin-form">
            <div className="admin-grid">
                {numberField("vote_threshold")}
                {numberField("dedup_radius_m")}
                {numberField("max_checks_per_day")}
            </div>
            <p><b>{t("admin.settings.rating")}</b></p>
            <div className="admin-grid">
                {(["check_correct", "check_wrong", "mark_confirmed", "mark_refuted", "task_completed"] as const).map((k) => numberField(`rating.${k}`))}
            </div>
            <p><b>{t("admin.settings.tasker")}</b></p>
            <div className="admin-grid">
                {numberField("tasker.max_tasks_per_user")}
                {numberField("tasker.target_probability")}
                {numberField("tasker.max_radius_meters")}
                <label className={`admin-field ${errors["tasker.task_ttl"] ? "invalid" : ""}`}>
                    <span>{t("admin.settings.tasker.task_ttl")}</span>
                    <input type="text" value={form.tasker.task_ttl} onChange={(e) => setForm(setPath(form, "tasker.task_ttl", e.target.value))} />
                    <small>1h30m · 24h · 90m</small>
                </label>
            </div>
            <div className="task-card__actions">
                <Button style="positive" disabled={pending || !dirty || Object.keys(errors).length > 0} onClick={save}>
                    {t(pending ? "common.saving" : ok ? "admin.settingsSaved" : "common.save")}
                </Button>
                <Button style="secondary" disabled={pending || !dirty} onClick={() => setForm(saved)}>{t("admin.reset")}</Button>
            </div>
        </div>
    );
};

// The colour here is DATA, not chrome: it is stored on the mark type and sent to
// the backend, and `<input type="color">` accepts only a literal hex. Both stay
// literals on purpose -- neither can be a token.
const EMPTY_TYPE: AddMarkTypeRequest = { code: "", name_ru: "", name_en: "", icon: "", color: "#e50000", sla_hours: 72 };

const MarkTypesTable = function MarkTypesTable() {
    const { t } = useT();
    const [types, setTypes] = useState<AdminMarkType[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [version, setVersion] = useState(0);
    const reload = useCallback(() => {
        setVersion((v) => v + 1);
        markTypesStore.fetch(); // the public dictionary (map markers / filters) follows the change
    }, []);

    useEffect(() => {
        let ignore = false;
        setIsLoading(true);
        AdminService.getMarkTypes()
            .then((data) => {
                if (!ignore) {
                    setTypes(data.payload);
                }
            })
            .catch((error) => {
                if (ignore) {
                    return;
                }
                console.error(error);
                notificationsStore.showError(error, t("admin.types.loadFailed"));
            })
            .finally(() => {
                if (!ignore) {
                    setIsLoading(false);
                }
            });
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [version]);

    return (
        <div className="admin-form">
            {isLoading && types.length === 0 && <p style={{ fontSize: 14 }}>{t("common.loading")}</p>}
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

const ApiKeysBlock = function ApiKeysBlock() {
    const { t, lang } = useT();
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [name, setName] = useState("");
    const [created, setCreated] = useState<CreatedApiKey | null>(null);
    const [copied, setCopied] = useState(false);
    const [pending, setPending] = useState<string | null>(null);
    const [version, setVersion] = useState(0);
    const reload = useCallback(() => setVersion((v) => v + 1), []);

    useEffect(() => {
        let ignore = false;
        AdminService.getApiKeys()
            .then((data) => {
                if (!ignore) {
                    setKeys(data.payload);
                }
            })
            .catch((error) => {
                if (ignore) {
                    return;
                }
                console.error(error);
                notificationsStore.showError(error, t("admin.keys.loadFailed"));
            });
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [version]);

    const create = () => {
        const keyName = name.trim();
        if (keyName === "") {
            return;
        }
        setPending("create");
        AdminService.createApiKey(keyName)
            .then((data) => {
                notificationsStore.clear();
                setCreated(data.payload);
                setCopied(false);
                setName("");
                reload();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("admin.keys.createFailed"));
            })
            .finally(() => setPending(null));
    };

    const copy = async () => {
        if (!created) {
            return;
        }
        try {
            await navigator.clipboard.writeText(created.key);
            setCopied(true);
        } catch (error) {
            console.error(error);
            window.prompt(t("admin.keys.copy"), created.key);
        }
    };

    const revoke = (key: ApiKey) => {
        if (!window.confirm(t("admin.keys.revokeQuestion", { name: key.name }))) {
            return;
        }
        setPending(`revoke-${key.id}`);
        AdminService.revokeApiKey(key.id)
            .then(() => {
                notificationsStore.clear();
                reload();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("admin.keys.revokeFailed"));
            })
            .finally(() => setPending(null));
    };

    return (
        <div className="admin-form">
            {created &&
                <div className="similar-block" role="alert">
                    <p><b>{t("admin.keys.created")}</b></p>
                    <code className="api-key">{created.key}</code>
                    <div className="task-card__actions">
                        <Button style="primary" isMini onClick={copy}>{t(copied ? "admin.keys.copied" : "admin.keys.copy")}</Button>
                        <Button style="secondary" isMini onClick={() => setCreated(null)}>{t("admin.keys.done")}</Button>
                    </div>
                </div>
            }
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
                <label className="admin-field" style={{ flex: 1, minWidth: 160 }}>
                    <span>{t("admin.keys.name")}</span>
                    <input type="text" value={name} maxLength={64} disabled={pending !== null} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { create(); } }} />
                </label>
                <Button style="primary" isMini disabled={pending !== null || name.trim() === ""} onClick={create}>{t(pending === "create" ? "admin.keys.creating" : "admin.keys.create")}</Button>
            </div>
            {keys.length === 0 && <p style={{ fontSize: 14 }}>{t("admin.keys.empty")}</p>}
            <div className="profile-list">
                {keys.map((key) => (
                    <div key={key.id} className="task-card">
                        <div className="task-card__row">
                            <p style={{ fontSize: 14 }}><b>{key.name}</b> {key.prefix && <code style={{ fontSize: 12 }}>{key.prefix}…</code>}</p>
                            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{key.created_at && new Date(key.created_at).toLocaleDateString(localeOf(lang))}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                            {t("admin.keys.lastUsed")}: {key.last_used_at ? new Date(key.last_used_at).toLocaleString(localeOf(lang), { dateStyle: "short", timeStyle: "short" }) : t("admin.keys.neverUsed")}
                        </p>
                        <div className="task-card__actions">
                            <Button style="negative" isMini disabled={pending !== null} onClick={() => revoke(key)}>{t("admin.keys.revoke")}</Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
