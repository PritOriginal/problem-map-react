import { useContext, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import MarksService from "../../../../../services/MarksService";
import { useT } from "../../../../../i18n";
import notificationsStore from "../../../../../store/notifications";
import user from "../../../../../store/user";
import { CommentsCount } from "../../../../badges/badges";
import ReportButton from "../../../../report/report-button";
import { MarkContext } from "../mark-context";
import "../mark-actions.scss";

/**
 * The toolbar over the mark: share it, follow it, report it, and the comment count.
 * Everything here needs an authorized user and a saved mark except sharing, which a
 * visitor can always do.
 */
export const MarkActions = observer(function MarkActions({ onDone }: { onDone: () => void }) {
    const mark = useContext(MarkContext);
    const isActionable = user.id !== 0 && mark.mark_id !== 0;

    return (
        <div className="mark-actions">
            <ShareButton />
            {isActionable && <FollowButton onDone={onDone} />}
            {isActionable && user.id !== mark.user_id && <ReportButton targetType="mark" targetId={mark.mark_id} />}
            <span className="mark-actions__spacer" />
            <span className="mark-actions__meta"><CommentsCount count={mark.comments_count} /></span>
        </div>
    );
});

/** "Слежу" toggle with the followers counter (`POST/DELETE /marks/{id}/follow`). */
const FollowButton = observer(function FollowButton({ onDone }: { onDone: () => void }) {
    const mark = useContext(MarkContext);
    const { t } = useT();
    const [pending, setPending] = useState(false);
    const following = mark.is_following === true;
    const count = mark.followers_count;

    const toggle = () => {
        setPending(true);
        (following ? MarksService.unfollowMark(mark.mark_id) : MarksService.followMark(mark.mark_id))
            .then(() => {
                notificationsStore.clear();
                onDone();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t(following ? "mark.unfollowFailed" : "mark.followFailed"));
            })
            .finally(() => setPending(false));
    };

    return (
        <button
            type="button"
            className={`mark-actions__btn${following ? " is-on" : ""}`}
            disabled={pending}
            aria-pressed={following}
            onClick={toggle}
        >
            <FollowIcon filled={following} />
            {t(following ? "mark.following" : "mark.follow")}
            {count !== undefined && <span className="mark-actions__count">{count}</span>}
        </button>
    );
});

function ShareButton() {
    const { t } = useT();
    const [copied, setCopied] = useState(false);
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const share = async () => {
        const url = window.location.href;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
            } else if (window.prompt(t("mark.copyLinkPrompt"), url) === null) {
                return;
            }
            setCopied(true);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error(error);
            notificationsStore.showError(error, t("mark.copyLinkFailed"));
        }
    };

    return (
        <button type="button" className="mark-actions__btn" onClick={share}>
            <ShareIcon />
            {t(copied ? "mark.linkCopied" : "mark.share")}
        </button>
    );
}

function ShareIcon() {
    return (
        <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 10.5V2M8 2 5 5M8 2l3 3M3 9v4.5h10V9" />
        </svg>
    );
}

/** A bookmark, filled once you are following: the state is in the shape, not only the word. */
function FollowIcon({ filled }: { filled: boolean }) {
    return (
        <svg viewBox="0 0 16 16" width="15" height="15" fill={filled ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 2.5h8v11l-4-3-4 3z" />
        </svg>
    );
}
