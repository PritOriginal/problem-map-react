import { useEffect, useRef } from "react";
import { localeOf, useT } from "../../../i18n";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";
import panelStore from "../../../store/panel";
import user from "../../../store/user";
import inboxStore from "../../../store/inbox";
import { Notification } from "../../../services/NotificationsService";
import UnauthorizedBlock from "../../unauthorized-block/unauthorized-block";
import { Button } from "../../button/button";
import { useToKeepSearch } from "../../../utils/navigation";

const NotificationsPanel = observer(function NotificationsPanel() {
    const { t } = useT();
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight);
            panelStore.setOpen(true);
        }
    }, []);

    const userId = user.id;
    useEffect(() => {
        if (userId !== 0) {
            inboxStore.fetch();
        }
    }, [userId]);

    const { items, isLoading, unreadCount } = inboxStore;

    return (
        <>
            <div ref={panelHeaderRef} className="panel__header" onClick={() => panelStore.toggle()}>
                <p><b>{t("notifications.title")}</b>{unreadCount > 0 && <span style={{ fontSize: 12 }}> {t("notifications.new", { count: unreadCount })}</span>}</p>
            </div>
            <div className="panel__content">
                {userId === 0 ?
                    <UnauthorizedBlock text={t("unauth.notifications")} />
                    :
                    <>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <Button style="white-2-black" isMini disabled={unreadCount === 0} onClick={inboxStore.markAllRead}>
                                {t("notifications.readAll")}
                            </Button>
                            <Button style="white-2-black" isMini disabled={isLoading} onClick={() => inboxStore.fetch()}>
                                {t("common.refresh")}
                            </Button>
                        </div>
                        {isLoading && items.length === 0 && <p style={{ fontSize: 14 }}>{t("common.loading")}</p>}
                        {!isLoading && items.length === 0 && <p style={{ fontSize: 14 }}>{t("notifications.empty")}</p>}
                        <div className="profile-list">
                            {items.map((n) => <NotificationRow key={n.id} item={n} />)}
                        </div>
                    </>
                }
            </div>
        </>
    );
});

const NotificationRow = observer(function NotificationRow({ item }: { item: Notification }) {
    const toKeepSearch = useToKeepSearch();
    const { t, lang } = useT();
    const unread = item.read_at === null;
    const date = new Date(item.created_at).toLocaleString(localeOf(lang));

    const content = (
        <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                <p style={{ fontSize: 14 }}>{unread && <span className="notification-dot" aria-label={t("notifications.unread")} />}<b>{item.title}</b></p>
                <p style={{ fontSize: 12, whiteSpace: "nowrap" }}>{date}</p>
            </div>
            {item.body !== "" && <p style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{item.body}</p>}
            {item.mark_id !== null && <p style={{ fontSize: 12, color: "#555" }}>{t("common.problemN", { id: item.mark_id })}</p>}
        </>
    );

    const onOpen = () => {
        inboxStore.markRead(item.id);
    };

    if (item.mark_id !== null) {
        return (
            <Link className={`profile-list__item ${unread ? "unread" : ""}`} to={toKeepSearch(`/problem/${item.mark_id}`)} onClick={onOpen}>
                {content}
            </Link>
        );
    }
    return (
        <div
            className={`profile-list__item ${unread ? "unread" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={unread ? t("notifications.markRead") : undefined}
            onClick={onOpen}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen();
                }
            }}
        >
            {content}
        </div>
    );
});

export default NotificationsPanel;
