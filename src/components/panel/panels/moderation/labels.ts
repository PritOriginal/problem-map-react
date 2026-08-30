import { ReportStatus, ReportTargetType } from "../../../../services/ReportsService";
import { TranslationKey } from "../../../../i18n";

/** Report status -> its label, shared by the queue filter and the card. */
export const STATUS_LABELS: Record<ReportStatus, TranslationKey> = {
    open: "moderation.status.open",
    resolved: "moderation.status.resolved",
    dismissed: "moderation.status.dismissed",
};

/** Report target -> its label, shared by the queue filter and the card. */
export const TARGET_LABELS: Record<ReportTargetType, TranslationKey> = {
    mark: "report.target.mark",
    check: "report.target.check",
    comment: "report.target.comment",
};
