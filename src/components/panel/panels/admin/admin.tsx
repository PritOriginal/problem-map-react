import { useState } from "react";
import { observer } from "mobx-react-lite";
import user from "../../../../store/user";
import { TranslationKey, useT } from "../../../../i18n";
import "../../../badges/badges.scss";
import "./admin.scss";
import PanelHeader from "../../panel-header";
import { SettingsForm } from "./settings-form";
import { MarkTypesTable } from "./mark-types-table";
import { ApiKeysBlock } from "./api-keys";

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
