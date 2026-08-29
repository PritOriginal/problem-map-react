import { observer } from "mobx-react-lite";
import offlineQueueStore from "../../../store/offline-queue";
import user from "../../../store/user";
import { Button } from "../../button/button";
import UnauthorizedBlock from "../../unauthorized-block/unauthorized-block";
import { useOnline } from "../../../utils/hooks";
import { localeOf, useT } from "../../../i18n";
import type { QueuedItem } from "../../../offline/types";
import "../../badges/badges.scss";
import PanelHeader from "../panel-header";

/** `/queue`: pending offline requests with a manual "Send" (backend integration/wave-5). */
const QueuePanel = observer(function QueuePanel() {
    const { t, lang } = useT();
    const online = useOnline();

    const items = offlineQueueStore.pending;

    const label = (item: QueuedItem): string => {
        switch (item.payload.kind) {
            case "mark":
                return t("offline.item.mark");
            case "check":
                return t("offline.item.check", { id: item.payload.mark_id });
            case "comment":
                return t("offline.item.comment", { id: item.payload.mark_id });
        }
    };

    return (
        <>
            <PanelHeader
                openOnMount
                title={t("offline.title")}
                subtitle={t("offline.queued", { count: items.length })}
                count={items.length}
                actions={user.id !== 0 &&
                    <button
                        type="button"
                        className="panel__header__act"
                        disabled={!online || offlineQueueStore.isFlushing || items.length === 0}
                        onClick={() => offlineQueueStore.flush()}
                    >
                        {t(offlineQueueStore.isFlushing ? "offline.sending" : "offline.send")}
                    </button>
                }
            />
            <div className="panel__content">
                {user.id === 0 ?
                    <UnauthorizedBlock text={t("unauth.profile")} />
                    :
                    <>
                        {items.length === 0 && <p className="empty-state">{t("offline.empty")}</p>}
                        {items.length > 0 &&
                            <div className="list-rows">
                                {items.map((item) => (
                                    <div key={item.id} className={`list-row${item.last_error ? " list-row--alert" : ""}`}>
                                        {/* The rule down the left says "this one failed",
                                            which the row otherwise only admitted in small
                                            red text at the bottom. */}
                                        <span className="list-row__mark" aria-hidden="true" />
                                        <span className="list-row__main">
                                            <span className="list-row__top">
                                                <b>{label(item)}</b>
                                                <time className="list-row__time" dateTime={item.created_at}>
                                                    {new Date(item.created_at).toLocaleString(localeOf(lang), { dateStyle: "short", timeStyle: "short" })}
                                                </time>
                                            </span>
                                            {item.payload.kind === "mark" && item.payload.description && <span className="list-row__body">{item.payload.description}</span>}
                                            {item.payload.kind === "check" && item.payload.comment && <span className="list-row__body">{item.payload.comment}</span>}
                                            {item.payload.kind === "comment" && <span className="list-row__body">{item.payload.body}</span>}
                                            {"photos" in item.payload && item.payload.photos.length > 0 && <span className="list-row__ref">{t("common.photos")}: {item.payload.photos.length}</span>}
                                            {item.last_error && <span className="list-row__error">{item.last_error} · {t("offline.attempts", { n: item.attempts })}</span>}
                                            <span className="list-row__actions">
                                                <Button style="secondary" isMini disabled={offlineQueueStore.isFlushing} onClick={() => offlineQueueStore.remove(item.id)}>{t("offline.remove")}</Button>
                                            </span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        }
                    </>
                }
            </div>
        </>
    );
});

export default QueuePanel;
