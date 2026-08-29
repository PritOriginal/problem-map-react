import { FormEvent, useCallback, useContext, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import CommentsService, { COMMENT_MAX_LENGTH, Comment } from "../../../../services/CommentsService";
import { canEditComment, threadComments } from "../../../../utils/comments";
import notificationsStore from "../../../../store/notifications";
import user from "../../../../store/user";
import offlineQueueStore from "../../../../store/offline-queue";
import { MarkContext } from "./mark-context";
import { Button } from "../../../button/button";
import ReportButton from "../../../report/report-button";
import { useNow } from "../../../../utils/hooks";
import { localeOf, useT } from "../../../../i18n";
import { Link } from "react-router-dom";
import { useToKeepSearch } from "../../../../utils/navigation";
import "./comments.scss";

const COMMENTS_LIMIT = 100;

/** Comments of the mark shown in the panel (backend integration/wave-5). */
const CommentsBlock = observer(function CommentsBlock() {
    const mark = useContext(MarkContext);
    const { t } = useT();
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [version, setVersion] = useState(0);
    const reload = useCallback(() => setVersion((v) => v + 1), []);
    const flushedAt = offlineQueueStore.lastFlushedAt;

    useEffect(() => {
        if (mark.mark_id === 0) {
            return;
        }
        let ignore = false;
        setIsLoading(true);
        CommentsService.getComments(mark.mark_id, COMMENTS_LIMIT, 0)
            .then((data) => {
                if (!ignore) {
                    setComments(data.payload);
                }
            })
            .catch((error) => {
                if (ignore) {
                    return;
                }
                console.error(error);
                notificationsStore.showError(error, t("comments.loadFailed"));
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
    }, [mark.mark_id, version, flushedAt]);

    const threads = threadComments(comments);
    const count = comments.filter((c) => !c.deleted).length;

    return (
        <>
            <p style={{ fontSize: 18 }}><b>{t("comments.title")}</b> {!isLoading && `(${count})`}</p>
            {isLoading && comments.length === 0 && <p style={{ fontSize: 14 }}>{t("common.loading")}</p>}
            {!isLoading && threads.length === 0 && <p style={{ fontSize: 14 }}>{t("comments.empty")}</p>}
            <div className="comments">
                {threads.map(({ root, replies }) => (
                    <div key={root.comment_id} className="comments__thread">
                        <CommentItem comment={root} onChanged={reload} canReply />
                        {replies.map((reply) => (
                            <CommentItem key={reply.comment_id} comment={reply} onChanged={reload} reply />
                        ))}
                    </div>
                ))}
            </div>
            {user.id !== 0
                ? <CommentForm markId={mark.mark_id} onDone={reload} />
                : <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>{t("comments.signIn")}</p>
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

    const remove = () => {
        if (!window.confirm(t("comments.deleteQuestion"))) {
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

    return (
        <div className={`comment ${reply ? "reply" : ""} ${comment.deleted ? "deleted" : ""}`}>
            <div className="comment__head">
                <Link to={toKeepSearch(`/users/${comment.user_id}`)} className="comment__author">{comment.username}{comment.is_mine && ` ${t("common.you")}`}</Link>
                <span className="comment__date">
                    {new Date(comment.created_at).toLocaleString(localeOf(lang), { dateStyle: "short", timeStyle: "short" })}
                    {edited && !comment.deleted && ` · ${t("comments.edited")}`}
                </span>
            </div>
            {comment.deleted
                ? <p className="comment__body comment__body--deleted">{t("comments.deleted")}</p>
                : editing
                    ? (
                        <>
                            <textarea className="edit-multiline-text" value={body} maxLength={COMMENT_MAX_LENGTH} rows={3} onChange={(e) => setBody(e.target.value)} />
                            <div className="comment__actions">
                                <Button style="green" isMini disabled={pending !== null} onClick={save}>{t(pending === "save" ? "common.saving" : "common.save")}</Button>
                                <Button style="white-2-black" isMini disabled={pending !== null} onClick={() => { setEditing(false); setBody(comment.body); }}>{t("common.cancel")}</Button>
                            </div>
                        </>
                    )
                    : <p className="comment__body">{comment.body}</p>
            }
            {!comment.deleted && !editing &&
                <div className="comment__actions">
                    {canReply && user.id !== 0 && <button type="button" className="comment__link" onClick={() => setReplying((v) => !v)}>{t("comments.reply")}</button>}
                    {editable && <button type="button" className="comment__link" onClick={() => { setBody(comment.body); setEditing(true); }}>{t("comments.edit")}</button>}
                    {deletable && <button type="button" className="comment__link danger" disabled={pending !== null} onClick={remove}>{t(pending === "delete" ? "common.deleting" : "common.delete")}</button>}
                    {!comment.is_mine && <ReportButton targetType="comment" targetId={comment.comment_id} small />}
                </div>
            }
            {replying && <CommentForm markId={comment.mark_id} parentId={comment.comment_id} onDone={() => { setReplying(false); onChanged(); }} onCancel={() => setReplying(false)} />}
        </div>
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
        <form className="comment-form" onSubmit={submit}>
            <textarea
                className="edit-multiline-text"
                value={body}
                placeholder={t(parentId ? "comments.replyPlaceholder" : "comments.placeholder")}
                maxLength={COMMENT_MAX_LENGTH}
                rows={parentId ? 2 : 3}
                disabled={pending}
                onChange={(e) => setBody(e.target.value)}
            />
            <div className="comment__actions">
                <button type="submit" className="black-2-white mini" disabled={pending || body.trim() === ""}>{t(pending ? "comments.sending" : "comments.send")}</button>
                {onCancel && <Button style="white-2-black" isMini disabled={pending} onClick={onCancel}>{t("common.cancel")}</Button>}
            </div>
        </form>
    );
}
