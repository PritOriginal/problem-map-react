import { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import user from "../../../../store/user";
import ReportsService, { REPORT_STATUSES, REPORT_TARGET_TYPES, Report, ReportStatus, ReportTargetType } from "../../../../services/ReportsService";
import MarksService, { Mark } from "../../../../services/MarksService";
import { useAsyncData } from "../../../../utils/use-async-data";
import { useT } from "../../../../i18n";
import { STATUS_LABELS, TARGET_LABELS } from "./labels";
import { ReportCard } from "./report-card";
import "../../../badges/badges.scss";
import PanelHeader from "../../panel-header";

const QUEUE_LIMIT = 100;

/** `/moderation`: the report queue with mark actions (moderator/admin, backend integration/wave-5). */
const ModerationPanel = observer(function ModerationPanel() {
    const { t } = useT();

    const [status, setStatus] = useState<ReportStatus>("open");
    const [targetType, setTargetType] = useState<ReportTargetType | "">("");

    const isModerator = user.isModerator;

    // `reload` is what a card calls after acting on a report; it replaces the version
    // counter this panel used to bump for the same purpose.
    const { data, isLoading, reload } = useAsyncData(
        (signal) => ReportsService
            .getQueue({ status, target_type: targetType || undefined, limit: QUEUE_LIMIT, offset: 0 }, { signal })
            .then((res) => res.payload),
        [status, targetType],
        { enabled: isModerator, errorMessage: t("moderation.loadFailed") },
    );
    const reports: Report[] = useMemo(() => data ?? [], [data]);

    // A queue of QUEUE_LIMIT reports used to mean that many parallel `getMarkById` calls, one
    // per card, and the panel froze behind them. They are loaded here instead, as a single
    // batch read (`GET /marks?ids=`), and handed to the cards as a prop. A failed batch leaves
    // those cards without their mark block, exactly as the per-card load did -- hence `silent`.
    // The key is the id list itself, so a reload that returns the same reports re-requests nothing.
    const missingIds = useMemo(() => missingMarkIds(reports).join(","), [reports]);
    const { data: fetched } = useAsyncData(
        async (signal) => {
            const loaded = await MarksService.getMarksByIds(missingIds.split(",").map(Number), { signal });
            const byId: Record<number, Mark> = {};
            for (const mark of loaded) {
                byId[mark.mark_id] = mark;
            }
            return byId;
        },
        [missingIds],
        { enabled: missingIds !== "", silent: true },
    );

    // The queue expands some marks inline; the rest arrive from the pass above.
    const marks: Record<number, Mark> = useMemo(
        () => ({ ...expandedMarks(reports), ...fetched }),
        [reports, fetched],
    );

    return (
        <>
            <PanelHeader openOnMount title={t("moderation.title")} subtitle={t("moderation.subtitle")} />
            <div className="panel__content">
                {!isModerator ?
                    <p className="empty-state">{t("moderation.unavailable")}</p>
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
                        {isLoading && reports.length === 0 && <p className="empty-state">{t("common.loading")}</p>}
                        {!isLoading && reports.length === 0 && <p className="empty-state">{t("moderation.empty")}</p>}
                        <div className="profile-list">
                            {reports.map((report) => <ReportCard key={report.report_id} report={report} mark={marks[report.target_id] ?? null} onDone={reload} />)}
                        </div>
                    </>
                }
            </div>
        </>
    );
});

export default ModerationPanel;

/** Marks the queue already expanded inline -- no request needed for these. */
function expandedMarks(reports: Report[]): Record<number, Mark> {
    const byId: Record<number, Mark> = {};
    for (const report of reports) {
        if (report.target_type === "mark" && report.target) {
            byId[report.target_id] = report.target;
        }
    }
    return byId;
}

/** Ids of mark reports the queue did not expand, deduplicated. */
function missingMarkIds(reports: Report[]): number[] {
    const ids = new Set<number>();
    for (const report of reports) {
        if (report.target_type === "mark" && !report.target) {
            ids.add(report.target_id);
        }
    }
    return [...ids];
}
