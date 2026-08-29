import { useContext, useState } from "react";
import MarksService, { MarkStatusType } from "../../../../../services/MarksService";
import { TranslationKey, useT } from "../../../../../i18n";
import notificationsStore from "../../../../../store/notifications";
import { Button } from "../../../../button/button";
import { useConfirm } from "../../../../confirm/use-confirm";
import { MarkContext } from "../mark-context";

const MODERATABLE_STATUSES = [
    MarkStatusType.UnconfirmedStatus,
    MarkStatusType.ConfirmedStatus,
    MarkStatusType.UnderReviewStatus,
    MarkStatusType.RediscoveredStatus,
];

type ModerationAction = "confirm" | "reject";

const MODERATION_ACTIONS: Record<ModerationAction, {
    call: (markId: number) => Promise<unknown>;
    question: TranslationKey;
    errorText: TranslationKey;
    label: TranslationKey;
    pendingLabel: TranslationKey;
    style: "positive" | "negative";
}> = {
    confirm: {
        call: (id) => MarksService.confirmMark(id),
        question: "mark.confirmQuestion",
        errorText: "mark.confirmFailed",
        label: "mark.confirm",
        pendingLabel: "mark.confirming",
        style: "positive",
    },
    reject: {
        call: (id) => MarksService.rejectMark(id),
        question: "mark.rejectQuestion",
        errorText: "mark.rejectFailed",
        label: "mark.reject",
        pendingLabel: "mark.rejecting",
        style: "negative",
    },
};

/** Moderator: confirms or rejects a mark that is still open to moderation. */
export function ModerationBlock({ onDone }: { onDone: () => void }) {
    const mark = useContext(MarkContext);
    const { t } = useT();
    const confirm = useConfirm();
    const [pending, setPending] = useState<ModerationAction | null>(null);

    if (!MODERATABLE_STATUSES.includes(mark.mark_status_id)) {
        return null;
    }

    const moderate = async (action: ModerationAction) => {
        const spec = MODERATION_ACTIONS[action];
        if (!await confirm({ question: t(spec.question, { id: mark.mark_id }), danger: spec.style === "negative" })) {
            return;
        }
        setPending(action);
        spec.call(mark.mark_id)
            .then(() => {
                notificationsStore.clear();
                onDone();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t(spec.errorText));
            })
            .finally(() => setPending(null));
    };

    return (
        <>
            <h2 className="section-title">{t("mark.moderation")}</h2>
            <div style={{ display: "flex", gap: "8px" }}>
                {(Object.keys(MODERATION_ACTIONS) as ModerationAction[]).map((action) => (
                    <Button key={action} style={MODERATION_ACTIONS[action].style} disabled={pending !== null} onClick={() => moderate(action)}>
                        {t(pending === action ? MODERATION_ACTIONS[action].pendingLabel : MODERATION_ACTIONS[action].label)}
                    </Button>
                ))}
            </div>
            <hr />
        </>
    );
}
