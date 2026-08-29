import { useState } from "react";
import { observer } from "mobx-react-lite";
import user from "../../../store/user";
import notificationsStore from "../../../store/notifications";
import AdminService, { ApiKey, CreatedApiKey } from "../../../services/AdminService";
import { useAsyncData } from "../../../utils/use-async-data";
import { Button } from "../../button/button";
import { TranslationKey, localeOf, useT } from "../../../i18n";
import "../../badges/badges.scss";
import "./admin.scss";
import PanelHeader from "../panel-header";
import { SettingsForm } from "./admin/settings-form";
import { MarkTypesTable } from "./admin/mark-types-table";

type TabKey = "settings" | "types" | "keys";

const TABS: { key: TabKey; label: TranslationKey }[] = [
    { key: "settings", label: "admin.tab.settings" },
    { key: "types", label: "admin.tab.types" },
    { key: "keys", label: "admin.tab.keys" },
];

/** `/admin`: settings, problem types and API keys (role admin, backend integration/wave-5). */
const AdminPanel = observer(function AdminPanel() {
    const { t } = useT();
    const [tab, setTab] = useState<TabKey>("settings");
    const isAdmin = user.id !== 0 && user.role === "admin";

    return (
        <>
            <PanelHeader openOnMount title={t("admin.title")} subtitle={t("admin.subtitle")} />
            <div className="panel__content">
                {!isAdmin ?
                    <p className="empty-state">{t("admin.unavailable")}</p>
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

const ApiKeysBlock = function ApiKeysBlock() {
    const { t, lang } = useT();
    const [name, setName] = useState("");
    const [created, setCreated] = useState<CreatedApiKey | null>(null);
    const [copied, setCopied] = useState(false);
    const [pending, setPending] = useState<string | null>(null);

    const { data, reload } = useAsyncData(
        (signal) => AdminService.getApiKeys({ signal }).then((res) => res.payload),
        [],
        { errorMessage: t("admin.keys.loadFailed") },
    );
    const keys: ApiKey[] = data ?? [];

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
            {keys.length === 0 && <p className="empty-state">{t("admin.keys.empty")}</p>}
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
