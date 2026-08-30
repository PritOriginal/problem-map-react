import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Button } from "../button/button";
import ReportsService, { REPORT_REASONS, ReportReason, ReportTargetType } from "../../services/ReportsService";
import { ApiError } from "../../services/http";
import notificationsStore from "../../store/notifications";
import user from "../../store/user";
import { TranslationKey, useT } from "../../i18n";
import { REASON_LABELS } from "../../utils/report";
import "./report-button.scss";

interface ReportButtonProps {
    targetType: ReportTargetType;
    targetId: number;
    /** Compact variant for comment rows. */
    small?: boolean;
}

/**
 * "Report" button that unfolds a reason picker (`POST /reports`, backend integration/wave-5).
 * 409 = already reported, 429 = rate limit; both are shown as friendly messages.
 */
const ReportButton = observer(function ReportButton({ targetType, targetId, small = false }: ReportButtonProps) {
    const { t } = useT();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState<ReportReason>("spam");
    const [comment, setComment] = useState("");
    const [pending, setPending] = useState(false);
    const [sent, setSent] = useState(false);
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    if (user.id === 0) {
        return null;
    }

    const send = () => {
        setPending(true);
        ReportsService.addReport({ target_type: targetType, target_id: targetId, reason, comment: comment.trim() || undefined })
            .then(() => {
                notificationsStore.clear();
                setOpen(false);
                setComment("");
                setSent(true);
                window.clearTimeout(timer.current);
                timer.current = window.setTimeout(() => setSent(false), 3000);
            })
            .catch((error) => {
                console.error(error);
                if (error instanceof ApiError && error.status === 409) {
                    notificationsStore.showError(null, t("report.duplicate"));
                    setOpen(false);
                } else if (error instanceof ApiError && error.status === 429) {
                    notificationsStore.showError(null, t("report.rateLimited"));
                } else {
                    notificationsStore.showError(error, t("report.failed"));
                }
            })
            .finally(() => setPending(false));
    };

    if (!open) {
        return (
            <button
                type="button"
                className={`report-button ${small ? "small" : ""}`}
                onClick={() => setOpen(true)}
                aria-label={`${t("report.button")}: ${t(`report.target.${targetType}` as TranslationKey)} ${targetId}`}
            >
                {sent ? t("report.sent") : t("report.button")}
            </button>
        );
    }

    return (
        <div className="report-form" role="dialog" aria-label={t("report.title")}>
            <label className="report-form__field">
                {t("report.reason")}
                <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} disabled={pending}>
                    {REPORT_REASONS.map((r) => (
                        <option key={r} value={r}>{t(REASON_LABELS[r])}</option>
                    ))}
                </select>
            </label>
            <label className="report-form__field">
                {t("report.comment")}
                <textarea
                    className="edit-multiline-text"
                    value={comment}
                    maxLength={512}
                    rows={2}
                    disabled={pending}
                    onChange={(e) => setComment(e.target.value)}
                />
            </label>
            <div className="report-form__actions">
                <Button style="negative" isMini disabled={pending} onClick={send}>{t(pending ? "report.sending" : "report.send")}</Button>
                <Button style="secondary" isMini disabled={pending} onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            </div>
        </div>
    );
});

export default ReportButton;
