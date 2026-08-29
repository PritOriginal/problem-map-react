import { Link, NavLink } from "react-router-dom";
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
import { Theme, THEMES, useSetTheme, useTheme } from "../../theme";

/**
 * A top-level section link that shows whether you are in that section.
 * `aria-current="page"` comes from NavLink, so the state is announced, not just painted.
 */
function NavItem({ to, label }: { to: ReturnType<ReturnType<typeof useToKeepSearch>>; label: string }) {
    return (
        <NavLink to={to} className={({ isActive }) => `header-nav-link${isActive ? " active" : ""}`}>
            {label}
        </NavLink>
    );
}

/** Cycles system -> light -> dark. The icon shows what is in effect right now. */
function ThemeSwitcher() {
    const { theme, resolved } = useTheme();
    const setTheme = useSetTheme();
    const { t } = useT();
    const label = t(`theme.${theme}` as Parameters<typeof t>[0]);

    return (
        <button
            type="button"
            className="header-theme"
            title={label}
            aria-label={label}
            onClick={() => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] as Theme)}
        >
            {theme === "auto"
                ? <AutoThemeIcon />
                : resolved === "dark" ? <MoonIcon /> : <SunIcon />}
        </button>
    );
}

function SunIcon() {
    return (
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <circle cx="8" cy="8" r="3.1" />
            <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1" strokeLinecap="round" />
        </svg>
    );
}

function MoonIcon() {
    return (
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z" strokeLinejoin="round" />
        </svg>
    );
}

/** Half light, half dark: the theme is whatever the device says. */
function AutoThemeIcon() {
    return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 2.6a5.4 5.4 0 0 1 0 10.8Z" fill="currentColor" />
        </svg>
    );
}

const Header = observer(function Header() {
    const { isMobile } = useDeviceDetect();
    const toKeepSearch = useToKeepSearch();
    const { t } = useT();

    return (
        <header className="app-header">
            <div className="header-container">
                <div className="header-container__menu">
                    <Link to={toKeepSearch("/")} aria-label={t("nav.map")} style={{ display: "flex" }}>
                        <MapIcon style={{ fill: "var(--on-chrome)", width: "32px" }} />
                    </Link>
                    <NavItem to={toKeepSearch("/tasks")} label={t("nav.tasks")} />
                    {user.isService && <NavItem to={toKeepSearch("/org")} label={t("nav.org")} />}
                    {user.isModerator && <NavItem to={toKeepSearch("/moderation")} label={t("nav.moderation")} />}
                    {user.role === "admin" && user.id !== 0 && <NavItem to={toKeepSearch("/admin")} label={t("nav.admin")} />}
                    <NavItem to={toKeepSearch("/leaderboard")} label={t("nav.leaderboard")} />
                    <NavItem to={toKeepSearch("/analytics")} label={t("nav.analytics")} />
                </div>
                <div className="header-container__user-info">
                    <ThemeSwitcher />
                    <LangSwitcher />
                    {user.id !== 0 ?
                        <>
                            <QueueBadge />
                            <NotificationsBell />
                            <Link className="header-container__user-info__item" to={toKeepSearch("/profile")}>
                                <p>{user.username}</p>
                                <ProfileIcon style={{ fill: "var(--on-chrome)", stroke: "var(--on-chrome)", height: "32px" }} />
                            </Link>
                        </>
                        :
                        <>
                            {isMobile ?
                                <Link className="header-container__user-info__item" to={"/signin"}>
                                    <p>{t("nav.signIn")}</p>
                                    <ProfileIcon style={{ fill: "var(--on-chrome)", stroke: "var(--on-chrome)", height: "32px" }} />
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
                                        <ProfileIcon style={{ fill: "var(--on-chrome)", stroke: "var(--on-chrome)", height: "32px" }} />
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
