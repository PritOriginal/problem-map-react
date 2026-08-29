import { Link } from "react-router-dom";
import "./Header.scss"
import user from "../../store/user";
import inboxStore from "../../store/inbox";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import ProfileIcon from "../../assets/profile.svg?react"
import MapIcon from "../../assets/map.svg?react"
import { useDeviceDetect } from "../../utils/hooks";
import { useToKeepSearch } from "../../utils/navigation";

const Header = observer(function Header() {
    const { isMobile } = useDeviceDetect();
    const toKeepSearch = useToKeepSearch();

    return (
        <header>
            <div className="header-container">
                <div className="header-container__menu">
                    <Link to={toKeepSearch("/")} aria-label="Карта" style={{ display: "flex" }}>
                        <MapIcon style={{ fill: "white", width: "32px" }} />
                    </Link>
                    <p style={{ color: "#bdbdbdff" }}>Задания</p>
                    <Link to={toKeepSearch("/leaderboard")}><p>Рейтинг</p></Link>
                    <Link to={toKeepSearch("/analytics")}><p>Аналитика</p></Link>
                </div>
                <div className="header-container__user-info">
                    {user.id !== 0 ?
                        <>
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
                                    <p>Войти</p>
                                    <ProfileIcon style={{ fill: "white", stroke: "white", height: "32px" }} />
                                </Link>
                                :
                                <>
                                    <Link className="header-container__user-info__item" to={"/signin"}>
                                        <p>Войти</p>
                                    </Link>
                                    <p>|</p>
                                    <Link to={"/signup"}>
                                        <p>Зарегистрироваться</p>
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

/** Bell with the unread badge; polls the counter every minute while mounted (i.e. while signed in). */
const NotificationsBell = observer(function NotificationsBell() {
    const toKeepSearch = useToKeepSearch();
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
    const label = count > 0 ? `Уведомления: ${count} непрочитанных` : "Уведомления";

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
