import { Link } from "react-router-dom";
import "./Header.scss"
import user from "../../store/user";
import inboxStore from "../../store/inbox";
import offlineQueueStore from "../../store/offline-queue";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import ProfileIcon from "../../assets/profile.svg?react"
import MapIcon from "../../assets/map.svg?react"
import { useDeviceDetect } from "../../utils/hooks";
import { useToKeepSearch } from "../../utils/navigation";
import { LANGS, Lang, setLang, useT } from "../../i18n";

const Header = observer(function Header() {
    const { isMobile } = useDeviceDetect();
    const toKeepSearch = useToKeepSearch();
    const { t } = useT();

    return (
        <header>
            <div className="header-container">
                <div className="header-container__menu">
                    <Link to={toKeepSearch("/")} aria-label={t("nav.map")} style={{ display: "flex" }}>
                        <MapIcon style={{ fill: "white", width: "32px" }} />
                    </Link>
                    <Link to={toKeepSearch("/tasks")}><p>{t("nav.tasks")}</p></Link>
                    {user.isService && <Link to={toKeepSearch("/org")}><p>{t("nav.org")}</p></Link>}
                    {user.isModerator && <Link to={toKeepSearch("/moderation")}><p>{t("nav.moderation")}</p></Link>}
                    {user.role === "admin" && user.id !== 0 && <Link to={toKeepSearch("/admin")}><p>{t("nav.admin")}</p></Link>}
                    <Link to={toKeepSearch("/leaderboard")}><p>{t("nav.leaderboard")}</p></Link>
                    <Link to={toKeepSearch("/analytics")}><p>{t("nav.analytics")}</p></Link>
                </div>
                <div className="header-container__user-info">
                    <LangSwitcher />
                    {user.id !== 0 ?
                        <>
                            <QueueBadge />
                            <NotificationsBell />
                            <Link className="header-container__user-info__item" to={toKeepSearch("/profile")}>
                                <p>{user.username}</p>
                                <ProfileIcon style={{ fill: "white", stroke: "white", height: "32px" }} />
                            </Link>
                        </>
                        :
                        <>
                            {isMobile ?
                                <Link className="header-container__user-info__item" to={"/signin"}>
                                    <p>{t("nav.signIn")}</p>
                                    <ProfileIcon style={{ fill: "white", stroke: "white", height: "32px" }} />
                                </Link>
                                :
                                <>
                                    <Link className="header-container__user-info__item" to={"/signin"}>
                                        <p>{t("nav.signIn")}</p>
                                    </Link>
                                    <p>|</p>
                                    <Link to={"/signup"}>
                                        <p>{t("nav.signUp")}</p>
                                    </Link>
                                    <Link className="header-container__user-info__item" to={"/signin"}>
                                        <ProfileIcon style={{ fill: "white", stroke: "white", height: "32px" }} />
                                    </Link>
                                </>
                            }
                        </>
                    }
                </div>
            </div>
        </header>
    );
});

/** ru / en toggle; the choice is persisted in localStorage and sent as `Accept-Language`. */
function LangSwitcher() {
    const { t, lang } = useT();
    return (
        <div className="header-lang" role="group" aria-label={t("nav.language")}>
            {LANGS.map((code: Lang) => (
                <button
                    key={code}
                    type="button"
                    className={`header-lang__item ${code === lang ? "active" : ""}`}
                    aria-pressed={code === lang}
                    onClick={() => setLang(code)}
                >
                    {code.toUpperCase()}
                </button>
            ))}
        </div>
    );
}

/** "Queued (N)" link to `/queue`; hidden when the offline queue is empty. */
const QueueBadge = observer(function QueueBadge() {
    const toKeepSearch = useToKeepSearch();
    const { t } = useT();
    const count = offlineQueueStore.count;
    if (count === 0) {
        return null;
    }
    return (
        <Link className="header-queue" to={toKeepSearch("/queue")} title={t("offline.title")}>
            <p>{t("nav.queue", { count })}</p>
        </Link>
    );
});

/** Bell with the unread badge; polls the counter every minute while mounted (i.e. while signed in). */
const NotificationsBell = observer(function NotificationsBell() {
    const toKeepSearch = useToKeepSearch();
    const { t } = useT();
    const userId = user.id;

    useEffect(() => {
        if (userId === 0) {
            return;
        }
        inboxStore.startPolling();
        return () => {
            inboxStore.stopPolling();
        };
    }, [userId]);

    const count = inboxStore.unreadCount;
    const label = count > 0 ? t("nav.notificationsUnread", { count }) : t("nav.notifications");

    return (
        <Link className="header-bell" to={toKeepSearch("/notifications")} aria-label={label} title={label}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6v-5c0-3.07-1.63-5.64-4.5-6.32V4a2.5 2.5 0 0 0-5 0v.68C6.63 5.36 5 7.92 5 11v5l-2 2v1h18v-1l-2-2z" />
            </svg>
            {count > 0 && <span className="header-bell__badge">{count > 99 ? "99+" : count}</span>}
        </Link>
    );
});

export default Header;
