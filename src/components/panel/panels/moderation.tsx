import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { LngLat } from "@yandex/ymaps3-types";
import panelStore from "../../../store/panel";
import user from "../../../store/user";
import notificationsStore from "../../../store/notifications";
import markTypesStore from "../../../store/mark-types";
import marksStore from "../../../store/marks";
import selectedMark from "../../../store/selected_mark";
import ReportsService, { REPORT_STATUSES, REPORT_TARGET_TYPES, Report, ReportStatus, ReportTargetType } from "../../../services/ReportsService";
import MarksService, { Mark, MarkStatusType, SimilarMark } from "../../../services/MarksService";
import { parseSimilarMarks, formatDistance } from "../../../utils/similar";
import { Button } from "../../button/button";
import { MarkBadges } from "../../badges/badges";
import { TypeIcon } from "../../mark/mark";
import { REASON_LABELS } from "../../../utils/report";
import { useNavigateKeepSearch } from "../../../utils/navigation";
import { TranslationKey, localeOf, useT } from "../../../i18n";
import "../../badges/badges.scss";

const QUEUE_LIMIT = 100;

const STATUS_LABELS: Record<ReportStatus, TranslationKey> = {
    open: "moderation.status.open",
    resolved: "moderation.status.resolved",
    dismissed: "moderation.status.dismissed",
};

const TARGET_LABELS: Record<ReportTargetType, TranslationKey> = {
    mark: "report.target.mark",
    check: "report.target.check",
    comment: "report.target.comment",
};

/** `/moderation`: the report queue with mark actions (moderator/admin, backend integration/wave-5). */
const ModerationPanel = observer(function ModerationPanel() {
    const { t } = useT();
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight);
            panelStore.setOpen(true);
        }
    }, []);

    const [status, setStatus] = useState<ReportStatus>("open");
    const [targetType, setTargetType] = useState<ReportTargetType | "">("");
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [version, setVersion] = useState(0);
    const reload = useCallback(() => setVersion((v) => v + 1), []);

    const isModerator = user.isModerator;

    useEffect(() => {
        if (!isModerator) {
            return;
        }
        let ignore = false;
        setIsLoading(true);
        ReportsService.getQueue({ status, target_type: targetType || undefined, limit: QUEUE_LIMIT, offset: 0 })
            .then((data) => {
                if (!ignore) {
                    setReports(data.payload);
                }
            })
            .catch((error) => {
                if (ignore) {
                    return;
                }
                console.error(error);
                notificationsStore.showError(error, t("moderation.loadFailed"));
            })
            .finally(() => {
                if (!ignore) {
                    setIsLoading(false);
                }
            });
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isModerator, status, targetType, version]);

    return (
        <>
            <div ref={panelHeaderRef} className="panel__header" onClick={() => panelStore.toggle()}>
                <p><b>{t("moderation.title")}</b></p>
                <p style={{ fontSize: 12 }}>{t("moderation.subtitle")}</p>
            </div>
            <div className="panel__content">
                {!isModerator ?
                    <p style={{ fontSize: 14 }}>{t("moderation.unavailable")}</p>
                    :
                    <>
                        <div className="analytics-controls">
                            <label>
                                {t("moderation.status")}
                                <select value={status} onChange={(e) => setStatus(e.target.value as ReportStatus)}>
                                    {REPORT_STATUSES.map((s) => <option key={s} value={s}>{t(STATUS_LABELS[s])}</option>)}
                                </select>
                            </label>
                            <label>
                                {t("moderation.targetType")}
                                <select value={targetType} onChange={(e) => setTargetType(e.target.value as ReportTargetType | "")}>
                                    <option value="">{t("moderation.allTargets")}</option>
                                    {REPORT_TARGET_TYPES.map((s) => <option key={s} value={s}>{t(TARGET_LABELS[s])}</option>)}
                                </select>
                            </label>
                        </div>
                        {isLoading && reports.length === 0 && <p style={{ fontSize: 14 }}>{t("common.loading")}</p>}
                        {!isLoading && reports.length === 0 && <p style={{ fontSize: 14 }}>{t("moderation.empty")}</p>}
                        <div className="profile-list">
                            {reports.map((report) => <ReportCard key={report.report_id} report={report} onDone={reload} />)}
                        </div>
                    </>
                }
            </div>
        </>
    );
});

export default ModerationPanel;

const ReportCard = observer(function ReportCard({ report, onDone }: { report: Report; onDone: () => void }) {
    const { t, lang } = useT();
    const navigate = useNavigateKeepSearch();
    const [pending, setPending] = useState<string | null>(null);
    const [merging, setMerging] = useState(false);
    const [mark, setMark] = useState<Mark | null>(report.target ?? null);

    // the queue may not expand the target: load the mark for mark reports
    useEffect(() => {
        if (mark || report.target_type !== "mark") {
            return;
        }
        let ignore = false;
        MarksService.getMarkById(report.target_id)
            .then((data) => {
                if (!ignore) {
                    setMark(data.payload.mark);
                }
            })
            .catch((error) => console.error(error));
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [report.target_id, report.target_type]);

    const type = mark ? markTypesStore.types.find((x) => x.mark_type_id === mark.mark_type_id) : undefined;

    const run = (key: string, call: () => Promise<unknown>, errorText: TranslationKey, after?: () => void) => {
        setPending(key);
        call()
            .then(() => {
                notificationsStore.clear();
                (after ?? onDone)();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t(errorText));
            })
            .finally(() => setPending(null));
    };

    const setStatus = (status: "resolved" | "dismissed") => run(status, () => ReportsService.setReportStatus(report.report_id, status), "moderation.statusFailed");

    const toggleHidden = () => {
        if (!mark) {
            return;
        }
        const hidden = !mark.hidden;
        if (hidden && !window.confirm(t("moderation.hideQuestion", { id: mark.mark_id }))) {
            return;
        }
        run("hidden", () => MarksService.setMarkHidden(mark.mark_id, hidden), "moderation.hiddenFailed", () => {
            setMark({ ...mark, hidden });
            marksStore.fetch();
        });
    };

    const open = () => {
        if (mark) {
            selectedMark.setId(mark.mark_id);
            selectedMark.setLoadedCoords(mark.mark_id, mark.geom.coordinates as LngLat);
        }
        navigate(`/problem/${mark?.mark_id ?? report.target_id}`);
    };

    return (
        <div className="task-card">
            <div className="task-card__row">
                <p style={{ fontSize: 14 }}>
                    <b>{t("moderation.reportN", { id: report.report_id })}</b> · {t(TARGET_LABELS[report.target_type] ?? "report.target.mark")} #{report.target_id}
                </p>
                <span className="data" style={{ fontSize: 12, color: "var(--ink-muted)" }}>{new Date(report.created_at).toLocaleString(localeOf(lang), { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
            <p style={{ fontSize: 13 }}>
                <b>{t("report.reason")}:</b> {t(REASON_LABELS[report.reason] ?? "report.reason.other")}
                {" · "}<b>{t("moderation.reporter")}:</b> #{report.reporter_id}
                {" · "}<b>{t("moderation.status")}:</b> {t(STATUS_LABELS[report.status] ?? "moderation.status.open")}
            </p>
            {report.comment && <p className="task-card__desc">{report.comment}</p>}
            {mark &&
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "6px", backgroundColor: "var(--surface-sunken)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <TypeIcon typeId={mark.mark_type_id} type={type} color="#000" />
                        <p style={{ fontSize: 13 }}><b>{t("mark.n", { id: mark.mark_id })}</b> {type?.name ?? ""}</p>
                    </div>
                    <MarkBadges mark={mark} />
                    {mark.description && <p className="task-card__desc">{mark.description}</p>}
                </div>
            }
            {merging && mark
                ? (
                    <MergeForm
                        mark={mark}
                        onCancel={() => setMerging(false)}
                        onDone={(target) => {
                            setMerging(false);
                            setMark({ ...mark, merged_into_id: target.mark_id, mark_status_id: MarkStatusType.DuplicateStatus });
                            marksStore.fetch();
                            onDone();
                        }}
                    />
                )
                : (
                    <div className="task-card__actions">
                        <Button style="secondary" isMini onClick={open}>{t("moderation.openTarget")}</Button>
                        {report.status === "open" &&
                            <>
                                <Button style="positive" isMini disabled={pending !== null} onClick={() => setStatus("resolved")}>{t("moderation.resolve")}</Button>
                                <Button style="secondary" isMini disabled={pending !== null} onClick={() => setStatus("dismissed")}>{t("moderation.dismiss")}</Button>
                            </>
                        }
                        {mark &&
                            <>
                                <Button style="primary" isMini disabled={pending !== null} onClick={toggleHidden}>{t(mark.hidden ? "moderation.show" : "moderation.hide")}</Button>
                                {!mark.merged_into_id && <Button style="secondary" isMini disabled={pending !== null} onClick={() => setMerging(true)}>{t("moderation.merge")}</Button>}
                            </>
                        }
                    </div>
                )
            }
        </div>
    );
});

/** "Merge into…": similar marks from `GET /marks/similar` plus a manual id -> `POST /marks/{id}/merge-into/{target}`. */
export const MergeForm = observer(function MergeForm({ mark, onCancel, onDone }: { mark: Mark; onCancel: () => void; onDone: (target: Mark) => void }) {
    const { t } = useT();
    const [similar, setSimilar] = useState<SimilarMark[]>([]);
    const [loading, setLoading] = useState(true);
    const [manualId, setManualId] = useState("");
    const [pending, setPending] = useState(false);

    useEffect(() => {
        let ignore = false;
        const [lon, lat] = mark.geom.coordinates as LngLat;
        MarksService.getSimilarMarks({ point: { longitude: lon, latitude: lat }, mark_type_id: mark.mark_type_id })
            .then((data) => {
                if (!ignore) {
                    setSimilar(parseSimilarMarks(data.payload).filter((m) => m.mark_id !== mark.mark_id));
                }
            })
            .catch((error) => console.error(error))
            .finally(() => {
                if (!ignore) {
                    setLoading(false);
                }
            });
        return () => {
            ignore = true;
        };
    }, [mark]);

    const merge = (targetId: number) => {
        if (!Number.isInteger(targetId) || targetId <= 0 || targetId === mark.mark_id) {
            return;
        }
        if (!window.confirm(t("moderation.mergeQuestion", { id: mark.mark_id, target: targetId }))) {
            return;
        }
        setPending(true);
        MarksService.mergeMark(mark.mark_id, targetId)
            .then((data) => {
                notificationsStore.clear();
                onDone(data.payload ?? ({ mark_id: targetId } as Mark));
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("moderation.mergeFailed"));
            })
            .finally(() => setPending(false));
    };

    return (
        <div className="similar-block">
            <p><b>{t("moderation.mergeTitle", { id: mark.mark_id })}</b></p>
            {loading && <p style={{ fontSize: 13 }}>{t("moderation.similarLoading")}</p>}
            {!loading && similar.length === 0 && <p style={{ fontSize: 13 }}>{t("moderation.similarEmpty")}</p>}
            <div className="similar-block__list">
                {similar.map((s) => {
                    const type = markTypesStore.types.find((x) => x.mark_type_id === s.mark_type_id);
                    const distance = formatDistance(s.distance_m);
                    return (
                        <div key={s.mark_id} className="similar-block__item">
                            <p><b>{t("mark.n", { id: s.mark_id })}</b> {type?.name ?? ""}{distance && ` · ${distance}`}</p>
                            <Button style="secondary" isMini disabled={pending} onClick={() => merge(s.mark_id)}>{t("moderation.mergeConfirm")}</Button>
                        </div>
                    );
                })}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                    type="number"
                    min={1}
                    placeholder={t("moderation.mergeManual")}
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    style={{ padding: "6px", fontSize: 13, width: "140px" }}
                    aria-label={t("moderation.mergeManual")}
                />
                <Button style="primary" isMini disabled={pending || manualId === ""} onClick={() => merge(Number(manualId))}>
                    {t(pending ? "moderation.merging" : "moderation.mergeConfirm")}
                </Button>
                <Button style="secondary" isMini disabled={pending} onClick={onCancel}>{t("common.cancel")}</Button>
            </div>
        </div>
    );
});
