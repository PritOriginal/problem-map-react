import { useState } from "react";
import { observer } from "mobx-react-lite";
import { LngLat } from "@yandex/ymaps3-types";
import user from "../../../store/user";
import notificationsStore from "../../../store/notifications";
import markTypesStore from "../../../store/mark-types";
import marksStore from "../../../store/marks";
import selectedMark from "../../../store/selected_mark";
import OrganizationsService from "../../../services/OrganizationsService";
import MarksService, { Mark, MarkStatusType } from "../../../services/MarksService";
import UnauthorizedBlock from "../../unauthorized-block/unauthorized-block";
import { Button } from "../../button/button";
import { MarkBadges } from "../../badges/badges";
import { TypeIcon } from "../../mark/mark";
import SelectFiles from "../../SelectFiles";
import { useNavigateKeepSearch } from "../../../utils/navigation";
import { useAsyncData } from "../../../utils/use-async-data";
import { useT } from "../../../i18n";
import "../../badges/badges.scss";
import PanelHeader from "../panel-header";
import { AsyncState } from "../async-state";

const ORG_QUEUE_LIMIT = 100;

/** Statuses shown in the organization queue: confirmed (to take) and in work (to report). */
const ORG_QUEUE_STATUSES = [MarkStatusType.ConfirmedStatus, MarkStatusType.InWorkStatus];

/** `/org`: service desk of the signed-in organization staff (`role === "service"`). */
const OrgPanel = observer(function OrgPanel() {
    const { t } = useT();

    const [onlyOverdue, setOnlyOverdue] = useState(false);

    const isService = user.isService;

    const { data: org = null } = useAsyncData(
        (signal) => OrganizationsService.getMe({ signal }).then((res) => res.payload),
        [],
        { enabled: isService, errorMessage: t("org.loadFailed") },
    );

    const orgId = org?.organization_id ?? 0;
    // `reload` is what a card calls after taking or resolving a mark; it replaces the
    // version counter this panel used to bump for the same purpose.
    const { data, isLoading, reload } = useAsyncData(
        (signal) => OrganizationsService
            .getMarks(orgId, { status_ids: ORG_QUEUE_STATUSES, overdue: onlyOverdue, limit: ORG_QUEUE_LIMIT, offset: 0 }, { signal })
            .then((res) => res.payload ?? []),
        [orgId, onlyOverdue],
        { enabled: orgId !== 0, errorMessage: t("org.queueFailed") },
    );
    const marks: Mark[] = data ?? [];

    return (
        <>
            <PanelHeader openOnMount title={org?.name ?? t("org.title")} subtitle={org?.description || t("org.title")} />
            <div className="panel__content">
                {!isService ?
                    <UnauthorizedBlock text={t("unauth.org")} />
                    :
                    <>
                        <div className="section-title-row">
                            <h2 className="section-title">{t("org.queue")}<span className="section-title__count">{!isLoading && `(${marks.length})`}</span></h2>
                            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: 13, cursor: "pointer" }}>
                                <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} />
                                {t("org.onlyOverdue")}
                            </label>
                        </div>
                        <AsyncState keepPrevious isLoading={isLoading} isEmpty={marks.length === 0} empty={t("org.empty")}>
                            <div className="profile-list">
                                {marks.map((mark) => <QueueCard key={mark.mark_id} mark={mark} onDone={reload} />)}
                            </div>
                        </AsyncState>
                    </>
                }
            </div>
        </>
    );
});

const QueueCard = observer(function QueueCard({ mark, onDone }: { mark: Mark; onDone: () => void }) {
    const { t } = useT();
    const navigate = useNavigateKeepSearch();
    const [pending, setPending] = useState(false);
    const [reporting, setReporting] = useState(false);

    const type = markTypesStore.types.find((x) => x.mark_type_id === mark.mark_type_id);

    const open = () => {
        selectedMark.setId(mark.mark_id);
        selectedMark.setLoadedCoords(mark.mark_id, mark.geom.coordinates as LngLat);
        navigate(`/problem/${mark.mark_id}`);
    };

    const start = () => {
        setPending(true);
        MarksService.startMark(mark.mark_id)
            .then(() => {
                notificationsStore.clear();
                marksStore.sync();
                onDone();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("org.startFailed"));
            })
            .finally(() => setPending(false));
    };

    return (
        <div className={`task-card ${mark.is_overdue ? "overdue" : ""}`}>
            <div className="task-card__row">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <TypeIcon typeId={mark.mark_type_id} type={type} color="#000" />
                    <p style={{ fontSize: 14 }}><b>{t("mark.n", { id: mark.mark_id })}</b> {type?.name ?? ""}</p>
                </div>
            </div>
            <MarkBadges mark={mark} />
            {mark.description !== "" && <p className="task-card__desc">{mark.description}</p>}
            {reporting ?
                <ResolveForm mark={mark} onCancel={() => setReporting(false)} onDone={() => { setReporting(false); onDone(); }} />
                :
                <div className="task-card__actions">
                    <Button style="secondary" isMini onClick={open}>{t("tasks.showOnMap")}</Button>
                    {mark.mark_status_id === MarkStatusType.ConfirmedStatus &&
                        <Button style="primary" isMini disabled={pending} onClick={start}>
                            {t(pending ? "org.starting" : "org.start")}
                        </Button>
                    }
                    {mark.mark_status_id === MarkStatusType.InWorkStatus &&
                        <Button style="positive" isMini onClick={() => setReporting(true)}>{t("org.resolve")}</Button>
                    }
                </div>
            }
        </div>
    );
});

/** Report form: comment + photos -> `POST /marks/{id}/resolve` (In work -> Under review). */
function ResolveForm({ mark, onCancel, onDone }: { mark: Mark; onCancel: () => void; onDone: () => void }) {
    const { t } = useT();
    const [comment, setComment] = useState("");
    const [photos, setPhotos] = useState<File[]>([]);
    const [pending, setPending] = useState(false);

    const send = () => {
        setPending(true);
        MarksService.resolveMark(mark.mark_id, comment, photos)
            .then(() => {
                notificationsStore.clear();
                marksStore.sync();
                onDone();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("org.resolveFailed"));
            })
            .finally(() => setPending(false));
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <p><b>{t("org.resolveTitle", { id: mark.mark_id })}</b></p>
            <p style={{ fontSize: 13 }}>{t("common.photos")}</p>
            <SelectFiles files={photos} onChange={setPhotos} />
            <p style={{ fontSize: 13 }}>{t("common.comment")}</p>
            <textarea
                className="edit-multiline-text"
                name="comment"
                value={comment}
                maxLength={1024}
                onChange={(e) => setComment(e.target.value)}
            ></textarea>
            <div className="task-card__actions">
                <Button style="positive" isMini disabled={pending || photos.length === 0} onClick={send}>
                    {t(pending ? "org.sending" : "org.send")}
                </Button>
                <Button style="secondary" isMini disabled={pending} onClick={onCancel}>{t("common.cancel")}</Button>
            </div>
        </div>
    );
}

export default OrgPanel;
