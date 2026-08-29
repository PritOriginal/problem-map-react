import { FormEvent, useContext, useState } from "react";
import { observer } from "mobx-react-lite";
import CommentsService, { COMMENT_MAX_LENGTH, Comment } from "../../../../services/CommentsService";
import { canEditComment, threadComments } from "../../../../utils/comments";
import notificationsStore from "../../../../store/notifications";
import user from "../../../../store/user";
import offlineQueueStore from "../../../../store/offline-queue";
import { MarkContext } from "./mark-context";
import { Button } from "../../../button/button";
import { useConfirm } from "../../../confirm/use-confirm";
import ReportButton from "../../../report/report-button";
import { useNow } from "../../../../utils/hooks";
import { useAsyncData } from "../../../../utils/use-async-data";
import { relativeTime } from "../../../../utils/relative-time";
import { TranslationKey, localeOf, useT } from "../../../../i18n";
import { Link } from "react-router-dom";
import { useToKeepSearch } from "../../../../utils/navigation";
import "./comments.scss";

const COMMENTS_LIMIT = 100;

/** Comments of the mark shown in the panel (backend integration/wave-5). */
const CommentsBlock = observer(function CommentsBlock() {
    const mark = useContext(MarkContext);
    const { t } = useT();
    // A queue flush can land a comment written offline, so it re-reads the thread.
    const flushedAt = offlineQueueStore.lastFlushedAt;

    // `reload` is what the form and every item call after writing; it replaces the
    // version counter this block used to bump for the same purpose.
    const { data, isLoading, reload } = useAsyncData(
        (signal) => CommentsService.getComments(mark.mark_id, COMMENTS_LIMIT, 0, { signal }).then((res) => res.payload),
        [mark.mark_id, flushedAt],
        { enabled: mark.mark_id !== 0, errorMessage: t("comments.loadFailed") },
    );
    const comments: Comment[] = data ?? [];

    const threads = threadComments(comments);
    const count = comments.filter((c) => !c.deleted).length;

    return (
        <>
            <h2 className="section-title">{t("comments.title")}<span className="section-title__count">{!isLoading && `(${count})`}</span></h2>
            {isLoading && comments.length === 0 && <p className="empty-state">{t("common.loading")}</p>}
            {!isLoading && threads.length === 0 && <p className="empty-state">{t("comments.empty")}</p>}
            <div className="comments">
                {threads.map(({ root, replies }) => (
                    <div key={root.comment_id} className="comments__thread">
                        <CommentItem comment={root} onChanged={reload} canReply />
                        {replies.length > 0 &&
                            <div className="comments__replies">
                                {replies.map((reply) => (
                                    <CommentItem key={reply.comment_id} comment={reply} onChanged={reload} reply />
                                ))}
                            </div>
                        }
                    </div>
                ))}
            </div>
            {user.id !== 0
                ? <CommentForm markId={mark.mark_id} onDone={reload} />
                : <p className="comments__signin">{t("comments.signIn")}</p>
            }
            <hr />
        </>
    );
});

export default CommentsBlock;

const CommentItem = observer(function CommentItem({ comment, onChanged, canReply = false, reply = false }: { comment: Comment; onChanged: () => void; canReply?: boolean; reply?: boolean }) {
    const { t, lang } = useT();
    const now = useNow();
    const toKeepSearch = useToKeepSearch();
    const [editing, setEditing] = useState(false);
    const [replying, setReplying] = useState(false);
    const [body, setBody] = useState(comment.body);
    const [pending, setPending] = useState<"save" | "delete" | null>(null);
    const confirm = useConfirm();

    const editable = canEditComment(comment, now);
    const deletable = !comment.deleted && (comment.is_mine || user.isModerator);
    const edited = comment.updated_at && comment.updated_at !== comment.created_at;

    const save = () => {
        const text = body.trim();
        if (text === "" || text === comment.body || text.length > COMMENT_MAX_LENGTH) {
            setEditing(false);
            return;
        }
        setPending("save");
        CommentsService.updateComment(comment.comment_id, text)
            .then(() => {
                notificationsStore.clear();
                setEditing(false);
                onChanged();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("comments.editFailed"));
            })
            .finally(() => setPending(null));
    };

    const remove = async () => {
        if (!await confirm({ question: t("comments.deleteQuestion"), danger: true })) {
            return;
        }
        setPending("delete");
        CommentsService.deleteComment(comment.comment_id)
            .then(() => {
                notificationsStore.clear();
                onChanged();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("comments.deleteFailed"));
            })
            .finally(() => setPending(null));
    };

    // "3 дн" is easier to place than a date, "37 дн" is not; past a week the
    // exact day is what a reader wants, so the helper says which to show.
    const when = relativeTime(comment.created_at, now);
    const stamp = when.kind === "now"
        ? t("common.justNow")
        : when.kind === "span"
            ? t("comments.ago", { span: `${when.value} ${t(`common.${when.unit}` as TranslationKey)}` })
            : new Date(comment.created_at).toLocaleString(localeOf(lang), { dateStyle: "short", timeStyle: "short" });

    return (
        <article className={`comment${reply ? " comment--reply" : ""}${comment.deleted ? " comment--deleted" : ""}`}>
            {/* Who is speaking, at a glance. The old block signalled it with a bold
                name at 12px and nothing else, which a thread cannot be scanned by. */}
            <span className={`comment-avatar${comment.is_mine ? " comment-avatar--mine" : ""}`} aria-hidden="true">
                {comment.username.slice(0, 1)}
            </span>
            <div className="comment__main">
                <div className="comment__head">
                    <Link to={toKeepSearch(`/users/${comment.user_id}`)} className="comment__author">{comment.username}</Link>
                    {comment.is_mine && <i className="you-chip">{t("common.youShort")}</i>}
                    <time className="comment__date" dateTime={comment.created_at}>
                        {stamp}
                        {edited && !comment.deleted && ` · ${t("comments.edited")}`}
                    </time>
                </div>
                {comment.deleted
                    ? <p className="comment__body comment__body--deleted">{t("comments.deleted")}</p>
                    : editing
                        ? (
                            <>
                                <textarea className="edit-multiline-text" value={body} maxLength={COMMENT_MAX_LENGTH} rows={3} onChange={(e) => setBody(e.target.value)} />
                                <div className="comment__actions">
                                    <Button style="positive" isMini disabled={pending !== null} onClick={save}>{t(pending === "save" ? "common.saving" : "common.save")}</Button>
                                    <Button style="secondary" isMini disabled={pending !== null} onClick={() => { setEditing(false); setBody(comment.body); }}>{t("common.cancel")}</Button>
                                </div>
                            </>
                        )
                        : <p className="comment__body">{comment.body}</p>
                }
                {!comment.deleted && !editing &&
                    <div className="comment__actions">
                        {/* Replying is the one action here worth colour. Reporting is
                            rare and used to be the loudest thing in every comment. */}
                        {canReply && user.id !== 0 && <button type="button" className="comment__link comment__link--key" onClick={() => setReplying((v) => !v)}>{t("comments.reply")}</button>}
                        {editable && <button type="button" className="comment__link" onClick={() => { setBody(comment.body); setEditing(true); }}>{t("comments.edit")}</button>}
                        {deletable && <button type="button" className="comment__link" disabled={pending !== null} onClick={remove}>{t(pending === "delete" ? "common.deleting" : "common.delete")}</button>}
                        {!comment.is_mine && <ReportButton targetType="comment" targetId={comment.comment_id} small />}
                    </div>
                }
                {replying && <CommentForm markId={comment.mark_id} parentId={comment.comment_id} onDone={() => { setReplying(false); onChanged(); }} onCancel={() => setReplying(false)} />}
            </div>
        </article>
    );
});

/** New comment / reply form; goes to the offline queue when the network is unavailable. */
function CommentForm({ markId, parentId, onDone, onCancel }: { markId: number; parentId?: number; onDone: () => void; onCancel?: () => void }) {
    const { t } = useT();
    const [body, setBody] = useState("");
    const [pending, setPending] = useState(false);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const text = body.trim();
        if (text === "" || text.length > COMMENT_MAX_LENGTH || markId === 0) {
            return;
        }
        setPending(true);
        offlineQueueStore.sendOrEnqueue(
            { kind: "comment", mark_id: markId, body: text, parent_id: parentId },
            (key) => CommentsService.addComment(markId, { body: text, parent_id: parentId }, key),
        )
            .then((res) => {
                notificationsStore.clear();
                setBody("");
                if (res.queued) {
                    notificationsStore.showError(null, t("comments.queued"));
                }
                onDone();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("comments.addFailed"));
            })
            .finally(() => setPending(false));
    };

    return (
        <form className={`comment-form${parentId ? "" : " comment-form--root"}`} onSubmit={submit}>
            <textarea
                className="edit-multiline-text"
                value={body}
                placeholder={t(parentId ? "comments.replyPlaceholder" : "comments.placeholder")}
                maxLength={COMMENT_MAX_LENGTH}
                rows={parentId ? 2 : 3}
                disabled={pending}
                onChange={(e) => setBody(e.target.value)}
            />
            <div className="comment-form__foot">
                {/* The limit is real and the old form never showed it. */}
                <span className="comment-form__count">{body.length} / {COMMENT_MAX_LENGTH}</span>
                {onCancel && <Button style="secondary" isMini disabled={pending} onClick={onCancel}>{t("common.cancel")}</Button>}
                <button type="submit" className="btn-primary mini comment-form__submit" disabled={pending || body.trim() === ""}>{t(pending ? "comments.sending" : "comments.send")}</button>
            </div>
        </form>
    );
}
