import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { LngLat } from "@yandex/ymaps3-types";
import notificationsStore from "../../../../store/notifications";
import markTypesStore from "../../../../store/mark-types";
import marksStore from "../../../../store/marks";
import selectedMark from "../../../../store/selected_mark";
import ReportsService, { Report } from "../../../../services/ReportsService";
import MarksService, { Mark, MarkStatusType } from "../../../../services/MarksService";
import { Button } from "../../../button/button";
import { useConfirm } from "../../../confirm/use-confirm";
import { MarkBadges } from "../../../badges/badges";
import { TypeIcon } from "../../../mark/mark";
import { REASON_LABELS } from "../../../../utils/report";
import { useNavigateKeepSearch } from "../../../../utils/navigation";
import { TranslationKey, localeOf, useT } from "../../../../i18n";
import { STATUS_LABELS, TARGET_LABELS } from "./labels";
import { MergeForm } from "./merge-block";
import "../../../badges/badges.scss";

/** One report in the moderation queue, with the actions that can be taken on it. */
export const ReportCard = observer(function ReportCard({ report, mark: loadedMark, onDone }: { report: Report; mark: Mark | null; onDone: () => void }) {
    const { t, lang } = useT();
    const confirm = useConfirm();
    const navigate = useNavigateKeepSearch();
    const [pending, setPending] = useState<string | null>(null);
    const [merging, setMerging] = useState(false);
    // The mark is loaded by the panel (see the queue effect); the card keeps its own
    // copy only so hiding and merging can show their result without waiting for the
    // queue to come back, and follows the prop again whenever the panel reloads.
    const [mark, setMark] = useState<Mark | null>(loadedMark);

    useEffect(() => {
        setMark(loadedMark);
    }, [loadedMark]);

    const type = mark ? markTypesStore.byId.get(mark.mark_type_id) : undefined;

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

    const toggleHidden = async () => {
        if (!mark) {
            return;
        }
        const hidden = !mark.hidden;
        if (hidden && !await confirm({ question: t("moderation.hideQuestion", { id: mark.mark_id }), danger: true })) {
            return;
        }
        run("hidden", () => MarksService.setMarkHidden(mark.mark_id, hidden), "moderation.hiddenFailed", () => {
            setMark({ ...mark, hidden });
            marksStore.sync();
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
                            marksStore.sync();
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

export default ReportCard;
