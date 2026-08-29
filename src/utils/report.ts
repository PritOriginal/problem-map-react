import type { TranslationKey } from "../i18n";
import type { ReportReason } from "../services/ReportsService";

export const REASON_LABELS: Record<ReportReason, TranslationKey> = {
    spam: "report.reason.spam",
    offensive: "report.reason.offensive",
    wrong_place: "report.reason.wrong_place",
    duplicate: "report.reason.duplicate",
    other: "report.reason.other",
};
