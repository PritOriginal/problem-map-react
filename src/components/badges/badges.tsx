import { observer } from "mobx-react-lite";
import { Mark } from "../../services/MarksService";
import markStatusesStore from "../../store/mark-statuses";
import organizationsStore from "../../store/organizations";
import { COLOR_MARK_STATUSES } from "../mark/mark";
import { deadlineState, formatSla } from "../../utils/deadline";
import { useNow } from "../../utils/hooks";
import { useT } from "../../i18n";
import "./badges.scss";

/** Outlined status chip colored by the mark status. */
export const StatusBadge = observer(function StatusBadge({ statusId }: { statusId: number }) {
    const { t } = useT();
    const status = markStatusesStore.statuses.find((s) => s.mark_status_id === statusId);
    return (
        <span className="profile-list__status" style={{ borderColor: COLOR_MARK_STATUSES[statusId] ?? "#000" }}>
            {status?.name ?? t("common.statusN", { id: statusId })}
        </span>
    );
});

/** `SLA: осталось …` / `SLA: просрочено на …` chip; renders nothing when the mark has no SLA. */
export function SlaBadge({ slaDueAt, isOverdue }: { slaDueAt: string | null | undefined; isOverdue?: boolean }) {
    const { lang } = useT();
    const now = useNow();
    const state = deadlineState(slaDueAt, now);
    if (!state) {
        return null;
    }
    const overdue = isOverdue || state.overdue;
    const className = overdue ? "overdue" : state.soon ? "soon" : "";
    return (
        <span className={`sla-badge ${className}`} title={new Date(slaDueAt!).toLocaleString()}>
            {formatSla(slaDueAt, now, lang)}
        </span>
    );
}

/** Organization name from the dictionary; nothing when the mark is not assigned. */
export const OrgLabel = observer(function OrgLabel({ organizationId }: { organizationId: number | null | undefined }) {
    const { t } = useT();
    if (organizationId === null || organizationId === undefined) {
        return null;
    }
    const name = organizationsStore.nameOf(organizationId);
    return (
        <span className="org-label" title={t("mark.organization")}>
            {name ?? `${t("mark.organization")} #${organizationId}`}
        </span>
    );
});

/** Status + SLA + organization chips of a mark, in one wrapping row. */
export function MarkBadges({ mark }: { mark: Pick<Mark, "mark_status_id" | "sla_due_at" | "is_overdue" | "organization_id"> }) {
    return (
        <div className="mark-badges">
            <StatusBadge statusId={mark.mark_status_id} />
            <SlaBadge slaDueAt={mark.sla_due_at} isOverdue={mark.is_overdue} />
            <OrgLabel organizationId={mark.organization_id} />
        </div>
    );
}
