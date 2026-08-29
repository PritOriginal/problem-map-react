import { useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import panelStore from "../../../store/panel";
import offlineQueueStore from "../../../store/offline-queue";
import user from "../../../store/user";
import { Button } from "../../button/button";
import UnauthorizedBlock from "../../unauthorized-block/unauthorized-block";
import { useOnline } from "../../../utils/hooks";
import { localeOf, useT } from "../../../i18n";
import type { QueuedItem } from "../../../offline/types";
import "../../badges/badges.scss";

/** `/queue`: pending offline requests with a manual "Send" (backend integration/wave-5). */
const QueuePanel = observer(function QueuePanel() {
    const { t, lang } = useT();
    const online = useOnline();
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight);
            panelStore.setOpen(true);
        }
    }, []);

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
            <div ref={panelHeaderRef} className="panel__header" onClick={() => panelStore.toggle()}>
                <p><b>{t("offline.title")}</b></p>
                <p style={{ fontSize: 12 }}>{t("offline.queued", { count: items.length })}</p>
            </div>
            <div className="panel__content">
                {user.id === 0 ?
                    <UnauthorizedBlock text={t("unauth.profile")} />
                    :
                    <>
                        <div className="task-card__actions">
                            <Button style="primary" disabled={!online || offlineQueueStore.isFlushing || items.length === 0} onClick={() => offlineQueueStore.flush()}>
                                {t(offlineQueueStore.isFlushing ? "offline.sending" : "offline.send")}
                            </Button>
                        </div>
                        {items.length === 0 && <p style={{ fontSize: 14 }}>{t("offline.empty")}</p>}
                        <div className="profile-list">
                            {items.map((item) => (
                                <div key={item.id} className={`task-card ${item.last_error ? "overdue" : ""}`}>
                                    <div className="task-card__row">
                                        <p style={{ fontSize: 14 }}><b>{label(item)}</b></p>
                                        <span className="data" style={{ fontSize: 12, color: "var(--ink-muted)" }}>{new Date(item.created_at).toLocaleString(localeOf(lang), { dateStyle: "short", timeStyle: "short" })}</span>
                                    </div>
                                    {item.payload.kind === "mark" && item.payload.description && <p className="task-card__desc">{item.payload.description}</p>}
                                    {item.payload.kind === "check" && item.payload.comment && <p className="task-card__desc">{item.payload.comment}</p>}
                                    {item.payload.kind === "comment" && <p className="task-card__desc">{item.payload.body}</p>}
                                    {"photos" in item.payload && item.payload.photos.length > 0 && <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>{t("common.photos")}: {item.payload.photos.length}</p>}
                                    {item.last_error && <p style={{ fontSize: 12, color: "var(--danger-ink)" }}>{item.last_error} · {t("offline.attempts", { n: item.attempts })}</p>}
                                    <div className="task-card__actions">
                                        <Button style="secondary" isMini disabled={offlineQueueStore.isFlushing} onClick={() => offlineQueueStore.remove(item.id)}>{t("offline.remove")}</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                }
            </div>
        </>
    );
});

export default QueuePanel;
