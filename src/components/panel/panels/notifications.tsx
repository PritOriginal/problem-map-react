import { useEffect } from "react";
import { TranslationKey, localeOf, useT } from "../../../i18n";
import { useNow } from "../../../utils/hooks";
import { relativeTime } from "../../../utils/relative-time";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";
import user from "../../../store/user";
import inboxStore from "../../../store/inbox";
import { Notification } from "../../../services/NotificationsService";
import UnauthorizedBlock from "../../unauthorized-block/unauthorized-block";
import { useToKeepSearch } from "../../../utils/navigation";
import PanelHeader from "../panel-header";
import { AsyncState } from "../async-state";

const NotificationsPanel = observer(function NotificationsPanel() {
    const { t } = useT();

    const userId = user.id;
    useEffect(() => {
        if (userId !== 0) {
            inboxStore.fetch();
        }
    }, [userId]);

    const { items, isLoading, unreadCount } = inboxStore;

    return (
        <>
            <PanelHeader
                openOnMount
                title={t("notifications.title")}
                count={unreadCount}
                actions={userId !== 0 &&
                    <>
                        <button type="button" className="panel__header__act" disabled={unreadCount === 0} onClick={inboxStore.markAllRead}>
                            {t("notifications.readAll")}
                        </button>
                        <button type="button" className="panel__header__act" disabled={isLoading} onClick={() => inboxStore.fetch()}>
                            {t("common.refresh")}
                        </button>
                    </>
                }
            />
            <div className="panel__content">
                {userId === 0 ?
                    <UnauthorizedBlock text={t("unauth.notifications")} />
                    :
                    <AsyncState keepPrevious isLoading={isLoading} isEmpty={items.length === 0} empty={t("notifications.empty")}>
                        <div className="list-rows">
                            {items.map((n) => <NotificationRow key={n.id} item={n} />)}
                        </div>
                    </AsyncState>
                }
            </div>
        </>
    );
});

const NotificationRow = observer(function NotificationRow({ item }: { item: Notification }) {
    const toKeepSearch = useToKeepSearch();
    const { t, lang } = useT();
    const now = useNow();
    const unread = item.read_at === null;

    // "3 дн" places a notification faster than a full timestamp does; past a week
    // the exact date is what the reader wants instead.
    const when = relativeTime(item.created_at, now);
    const stamp = when.kind === "now"
        ? t("common.justNow")
        : when.kind === "span"
            ? t("comments.ago", { span: `${when.value} ${t(`common.${when.unit}` as TranslationKey)}` })
            : new Date(item.created_at).toLocaleString(localeOf(lang), { dateStyle: "short", timeStyle: "short" });

    const content = (
        <>
            {/* Unread used to be said twice: a dot before the title and a rule down
                the left edge. The rule alone carries it. */}
            <span className="list-row__mark" aria-hidden="true" />
            <span className="list-row__main">
                <span className="list-row__top">
                    {unread && <span className="visually-hidden">{t("notifications.unread")}: </span>}
                    <b>{item.title}</b>
                    <time className="list-row__time" dateTime={item.created_at}>{stamp}</time>
                </span>
                {item.body !== "" && <span className="list-row__body">{item.body}</span>}
                {item.mark_id !== null && <span className="list-row__ref">{t("common.problemN", { id: item.mark_id })}</span>}
            </span>
        </>
    );

    const onOpen = () => {
        inboxStore.markRead(item.id);
    };

    if (item.mark_id !== null) {
        return (
            <Link className={`list-row${unread ? " list-row--unread" : ""}`} to={toKeepSearch(`/problem/${item.mark_id}`)} onClick={onOpen}>
                {content}
            </Link>
        );
    }
    return (
        <button
            type="button"
            className={`list-row${unread ? " list-row--unread" : ""}`}
            aria-label={unread ? t("notifications.markRead") : undefined}
            onClick={onOpen}
        >
            {content}
        </button>
    );
});

export default NotificationsPanel;
