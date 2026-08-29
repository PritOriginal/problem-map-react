import { useState } from "react";
import notificationsStore from "../../../../store/notifications";
import AdminService, { ApiKey, CreatedApiKey } from "../../../../services/AdminService";
import { useAsyncData } from "../../../../utils/use-async-data";
import { Button } from "../../../button/button";
import { localeOf, useT } from "../../../../i18n";

/** Keys tab of `/admin`: issue an API key (shown once) and revoke the existing ones. */
export const ApiKeysBlock = function ApiKeysBlock() {
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

export default ApiKeysBlock;
