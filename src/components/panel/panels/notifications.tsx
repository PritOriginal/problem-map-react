import { useEffect, useRef } from "react";
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
                <p><b>Уведомления</b>{unreadCount > 0 && <span style={{ fontSize: 12 }}> ({unreadCount} новых)</span>}</p>
            </div>
            <div className="panel__content">
                {userId === 0 ?
                    <UnauthorizedBlock text="Чтобы видеть уведомления, войдите в аккаунт" />
                    :
                    <>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <Button style="white-2-black" isMini disabled={unreadCount === 0} onClick={inboxStore.markAllRead}>
                                Прочитать все
                            </Button>
                            <Button style="white-2-black" isMini disabled={isLoading} onClick={() => inboxStore.fetch()}>
                                Обновить
                            </Button>
                        </div>
                        {isLoading && items.length === 0 && <p style={{ fontSize: 14 }}>Загрузка…</p>}
                        {!isLoading && items.length === 0 && <p style={{ fontSize: 14 }}>Уведомлений пока нет</p>}
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
    const unread = item.read_at === null;
    const date = new Date(item.created_at).toLocaleString();

    const content = (
        <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                <p style={{ fontSize: 14 }}>{unread && <span className="notification-dot" aria-label="Непрочитано" />}<b>{item.title}</b></p>
                <p style={{ fontSize: 12, whiteSpace: "nowrap" }}>{date}</p>
            </div>
            {item.body !== "" && <p style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{item.body}</p>}
            {item.mark_id !== null && <p style={{ fontSize: 12, color: "#555" }}>Проблема №{item.mark_id}</p>}
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
        <div className={`profile-list__item ${unread ? "unread" : ""}`} onClick={onOpen}>
            {content}
        </div>
    );
});

export default NotificationsPanel;
