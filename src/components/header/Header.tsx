import { Link, NavLink, useLocation } from "react-router-dom";
import "./Header.scss"
import user from "../../store/user";
import inboxStore from "../../store/inbox";
import offlineQueueStore from "../../store/offline-queue";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import ProfileIcon from "../../assets/profile.svg?react"
import MapIcon from "../../assets/map.svg?react"
import SunIcon from "../../assets/sun.svg?react"
import MoonIcon from "../../assets/moon.svg?react"
// Half light, half dark: the theme is whatever the device says.
import AutoThemeIcon from "../../assets/theme-auto.svg?react"
// The burger. Only ever rendered on the narrow layout.
import MenuIcon from "../../assets/menu.svg?react"
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

const Header = observer(function Header() {
    const { isMobile } = useDeviceDetect();
    const toKeepSearch = useToKeepSearch();
    const { t } = useT();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    // The sections a role can reach run from two to six. That range is exactly why
    // the narrow layout folds them into a list instead of trying to fit them in a
    // row: a header that holds four names does not hold six.
    const sections = [
        { to: "/tasks", label: t("nav.tasks"), show: true },
        { to: "/org", label: t("nav.org"), show: user.isService },
        { to: "/moderation", label: t("nav.moderation"), show: user.isModerator },
        { to: "/admin", label: t("nav.admin"), show: user.role === "admin" && user.id !== 0 },
        { to: "/leaderboard", label: t("nav.leaderboard"), show: true },
        { to: "/analytics", label: t("nav.analytics"), show: true },
    ].filter((section) => section.show);

    // Navigating closes the menu; so does growing past the breakpoint, or the menu
    // would still be open, invisible, behind a header that no longer has a burger.
    useEffect(() => setMenuOpen(false), [location]);
    useEffect(() => {
        if (!isMobile) {
            setMenuOpen(false);
        }
    }, [isMobile]);

    useEffect(() => {
        if (!menuOpen) {
            return;
        }
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setMenuOpen(false);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [menuOpen]);

    const settings = (
        <>
            <ThemeSwitcher />
            <LangSwitcher />
        </>
    );

    return (
        <header className="app-header">
            <div className="app-header__bar">
                {isMobile &&
                    <button
                        type="button"
                        className="app-header__burger"
                        aria-expanded={menuOpen}
                        aria-controls="app-menu"
                        aria-label={t("nav.menu")}
                        onClick={() => setMenuOpen(!menuOpen)}
                    >
                        <MenuIcon />
                    </button>
                }

                {/* The product had no name anywhere in the interface. This is also the
                    one place it can say which city it serves. */}
                <Link className="app-mark" to={toKeepSearch("/")} aria-label={t("nav.map")}>
                    <MapIcon className="app-mark__pin" />
                    <span className="app-mark__stack">
                        <b>{t("app.name")}</b>
                        <em>{t("app.city")}</em>
                    </span>
                </Link>

                {!isMobile &&
                    <nav className="app-nav">
                        {sections.map((section) => (
                            <NavItem key={section.to} to={toKeepSearch(section.to)} label={section.label} />
                        ))}
                    </nav>
                }

                <div className="app-header__right">
                    {!isMobile && settings}
                    <span className="app-header__sep" aria-hidden="true" />
                    {user.id !== 0 ?
                        <>
                            <QueueBadge />
                            <NotificationsBell />
                            <Link className="app-account" to={toKeepSearch("/profile")}>
                                <span className="app-account__avatar"><ProfileIcon /></span>
                                {!isMobile && <b>{user.username}</b>}
                            </Link>
                        </>
                        :
                        <>
                            {/* One quiet link and one filled button, not two links of equal
                                weight separated by a literal "|" character -- and no third
                                control (the profile icon) pointing at the same place. */}
                            <Link className="app-header__signin" to={"/signin"}>{t("nav.signIn")}</Link>
                            <Link className="app-header__cta" to={"/signup"}>
                                {isMobile ? t("nav.createAccountShort") : t("nav.createAccount")}
                            </Link>
                        </>
                    }
                </div>
            </div>

            {isMobile && menuOpen &&
                <nav className="app-menu" id="app-menu">
                    {sections.map((section) => (
                        <NavLink
                            key={section.to}
                            to={toKeepSearch(section.to)}
                            className={({ isActive }) => `app-menu__item${isActive ? " active" : ""}`}
                        >
                            {section.label}
                        </NavLink>
                    ))}
                    <div className="app-menu__foot">{settings}</div>
                </nav>
            }
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6v-5c0-3.07-1.63-5.64-4.5-6.32V4a2.5 2.5 0 0 0-5 0v.68C6.63 5.36 5 7.92 5 11v5l-2 2v1h18v-1l-2-2z" />
            </svg>
            {count > 0 && <span className="header-bell__badge">{count > 99 ? "99+" : count}</span>}
        </Link>
    );
});

export default Header;
