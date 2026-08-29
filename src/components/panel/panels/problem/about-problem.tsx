import { useContext, useEffect, useRef, useState } from "react";
import MarksService, { MarkStatusHistoryItem, MarkStatusType, MarkType } from "../../../../services/MarksService";
import Select from "react-select";
import markTypesStore from "../../../../store/mark-types";
import { Button } from "../../../button/button";
import DoubleProgressBar from "../../../double-progress-bar/double-progress-bar";
import { useNavigateKeepSearch } from "../../../../utils/navigation";
import { Check } from "../../../../services/ChecksService";
import { MarkContext, MarkReloadContext } from "./mark-context";
import { observer } from "mobx-react-lite";
import user from "../../../../store/user";
import markStatusesStore from "../../../../store/mark-statuses";
import notificationsStore from "../../../../store/notifications";
import marksStore from "../../../../store/marks";
import organizationsStore from "../../../../store/organizations";
import { TranslationKey, localeOf, tOr, useT } from "../../../../i18n";
import ReportButton from "../../../report/report-button";
import CommentsBlock from "./comments";
import { CommentsCount, DuplicateBadge, HiddenBadge } from "../../../badges/badges";
import { STATUS_COLORS, STATUS_FALLBACK } from "../../../../styles/tokens";
import { layerDepths, layerSpans, spanLabel } from "../../../../utils/history-column";
import { useNow } from "../../../../utils/hooks";
import "./history-column.scss";
import "./mark-actions.scss";
import "./checks.scss";

const AboutProblem = observer(function AboutProblem() {
    const navigate = useNavigateKeepSearch();
    const { t } = useT();

    const mark = useContext(MarkContext)
    const reload = useContext(MarkReloadContext)
    const [historyItems, setHistoryItems] = useState<MarkStatusHistoryItem[]>([])

    const groups: MarkStatusHistoryItem[][] = []
    let groupHistoryItems: MarkStatusHistoryItem[] = []
    for (let index = historyItems.length - 1; index >= 0; index--) {
        const historyItem = historyItems[index];
        const markStatus = markStatusesStore.statuses.find((satus) => satus.mark_status_id == historyItem.new_mark_status_id);

        groupHistoryItems.unshift(historyItem);
        // statuses with a parent are grouped under their parent status
        if (markStatus?.parent_id == null) {
            groups.unshift(groupHistoryItems);
            groupHistoryItems = [];
        }
    }

    // The column's geometry: how long the mark sat in each status, and how deep to
    // draw that stratum. `useNow` keeps the last (still-running) layer honest.
    const now = useNow();
    const spans = layerSpans(groups.map((group) => group[0].changed_at), now);
    const depths = layerDepths(spans);

    let possibilityAddCheck = true;
    if (user.id != 0 && historyItems.length > 0) {
        if (mark.mark_status_id == MarkStatusType.ClosedStatus ||
            mark.mark_status_id == MarkStatusType.RefutedStatus ||
            mark.mark_status_id == MarkStatusType.DuplicateStatus) {
            possibilityAddCheck = false;
        }

        const lastGroupHistoryItems = groups[groups.length - 1]
        lastGroupHistoryItems.forEach(item => {
            const checks = item.checks;
            const findCheck = checks?.find((check) => { return check.user_id == user.id })
            if (findCheck) {
                possibilityAddCheck = false
            }
        });
    }

    useEffect(() => {
        if (mark.mark_id === 0) {
            return;
        }
        let ignore = false;
        MarksService.getMarkStatusHistoryByMarkId(mark.mark_id, true)
            .then((data) => {
                if (!ignore) {
                    setHistoryItems(data.payload.items);
                }
            })
            .catch((error) => {
                if (ignore) {
                    return;
                }
                console.error(error);
                notificationsStore.showError(error, t("mark.historyLoadFailed"));
            });
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mark])

    const handleOnClickNewCheck = () => {
        navigate(`/problem/${mark.mark_id}/add-check`)
    }

    return (
        <>
            <div className="mark-actions">
                <ShareButton />
                {user.id !== 0 && mark.mark_id !== 0 && <FollowButton onDone={reload} />}
                {user.id !== 0 && mark.mark_id !== 0 && user.id !== mark.user_id && <ReportButton targetType="mark" targetId={mark.mark_id} />}
                <span className="mark-actions__spacer" />
                <span className="mark-actions__meta"><CommentsCount count={mark.comments_count} /></span>
            </div>
            {(mark.hidden || mark.merged_into_id) &&
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                    <HiddenBadge hidden={mark.hidden} />
                    <DuplicateBadge mergedIntoId={mark.merged_into_id} />
                </div>
            }
            {user.isModerator && mark.mark_id !== 0 && <ModerationBlock onDone={reload} />}
            {user.isModerator && mark.mark_id !== 0 && <AssignBlock onDone={reload} />}
            {user.id !== 0 && user.id === mark.user_id && mark.mark_status_id === MarkStatusType.UnconfirmedStatus && <OwnerBlock onDone={reload} />}
            {mark.description !== "" &&
                <>
                    <h2 className="section-title">{t("common.description")}</h2>
                    <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{mark.description}</p>
                    <hr />
                </>
            }
            <h2 className="section-title">{t("mark.history")}</h2>
            <hr />
            <ol className="core">
                {groups.map((group, index) => (
                    <HistoryGroup
                        key={index}
                        group={group}
                        depth={depths[index]}
                        spanMs={spans[index]}
                        isLast={index === groups.length - 1}
                    />
                ))}
            </ol>
            {mark.mark_id !== 0 && <CommentsBlock />}
            {possibilityAddCheck &&
                <div style={{ position: "sticky", bottom: "0" }}>
                    <Button style="primary" onClick={handleOnClickNewCheck}>
                        {t("mark.checkButton")}
                    </Button>
                </div>
            }
        </>
    );
});

export default AboutProblem;

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

function ModerationBlock({ onDone }: { onDone: () => void }) {
    const mark = useContext(MarkContext);
    const { t } = useT();
    const [pending, setPending] = useState<ModerationAction | null>(null);

    if (!MODERATABLE_STATUSES.includes(mark.mark_status_id)) {
        return null;
    }

    const moderate = (action: ModerationAction) => {
        const spec = MODERATION_ACTIONS[action];
        if (!window.confirm(t(spec.question, { id: mark.mark_id }))) {
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

/** Moderator/admin: assigns the mark to an organization (`PATCH /marks/{id}/assign`). */
const AssignBlock = observer(function AssignBlock({ onDone }: { onDone: () => void }) {
    const mark = useContext(MarkContext);
    const { t } = useT();
    const [pending, setPending] = useState(false);

    useEffect(() => {
        organizationsStore.fetch();
    }, []);

    const options = organizationsStore.items.map((o) => ({ value: o.organization_id, label: o.name }));
    const current = options.find((o) => o.value === mark.organization_id) ?? null;

    const assign = (organizationId: number) => {
        setPending(true);
        MarksService.assignMark(mark.mark_id, organizationId)
            .then(() => {
                notificationsStore.clear();
                onDone();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("mark.assignFailed"));
            })
            .finally(() => setPending(false));
    };

    return (
        <>
            <p><b>{t("mark.assignOrganization")}</b></p>
            <Select
                options={options}
                value={current}
                placeholder={t("mark.noOrganization")}
                isDisabled={pending || options.length === 0}
                isLoading={organizationsStore.isLoading}
                onChange={(val) => { if (val && val.value !== mark.organization_id) { assign(val.value); } }}
            />
            <hr />
        </>
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

/** Owner-only actions for an unconfirmed mark: edit description/type, delete. */
const OwnerBlock = observer(function OwnerBlock({ onDone }: { onDone: () => void }) {
    const mark = useContext(MarkContext);
    const navigate = useNavigateKeepSearch();
    const { t } = useT();
    const [editing, setEditing] = useState(false);
    const [description, setDescription] = useState(mark.description);
    const [typeId, setTypeId] = useState(mark.mark_type_id);
    const [pending, setPending] = useState<"save" | "delete" | null>(null);

    const startEdit = () => {
        setDescription(mark.description);
        setTypeId(mark.mark_type_id);
        setEditing(true);
    };

    const save = () => {
        const req: { description?: string; mark_type_id?: number } = {};
        if (description !== mark.description) {
            req.description = description;
        }
        if (typeId !== mark.mark_type_id) {
            req.mark_type_id = typeId;
        }
        if (Object.keys(req).length === 0) {
            setEditing(false);
            return;
        }
        setPending("save");
        MarksService.updateMark(mark.mark_id, req)
            .then(() => {
                notificationsStore.clear();
                setEditing(false);
                onDone();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("mark.saveFailed"));
            })
            .finally(() => setPending(null));
    };

    const remove = () => {
        if (!window.confirm(t("mark.deleteQuestion", { id: mark.mark_id }))) {
            return;
        }
        setPending("delete");
        MarksService.deleteMark(mark.mark_id)
            .then(() => {
                notificationsStore.clear();
                marksStore.sync();
                navigate("/");
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("mark.deleteFailed"));
                setPending(null);
            });
    };

    const options = markTypesStore.types.map((t: MarkType) => ({ value: t.mark_type_id, label: t.name }));

    return (
        <>
            <h2 className="section-title">{t("mark.mine")}</h2>
            {editing ?
                <>
                    <p><b>{t("common.category")}</b></p>
                    <Select
                        options={options}
                        value={options.find((o) => o.value === typeId) ?? null}
                        onChange={(val) => { if (val) { setTypeId(val.value); } }}
                        isDisabled={options.length === 0}
                    />
                    <p><b>{t("common.description")}</b></p>
                    <textarea
                        className="edit-multiline-text"
                        name="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    ></textarea>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <Button style="positive" disabled={pending !== null} onClick={save}>
                            {t(pending === "save" ? "common.saving" : "common.save")}
                        </Button>
                        <Button style="secondary" disabled={pending !== null} onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
                    </div>
                </>
                :
                <div style={{ display: "flex", gap: "8px" }}>
                    <Button style="secondary" disabled={pending !== null} onClick={startEdit}>{t("common.edit")}</Button>
                    <Button style="negative" disabled={pending !== null} onClick={remove}>
                        {t(pending === "delete" ? "common.deleting" : "common.delete")}
                    </Button>
                </div>
            }
            <hr />
        </>
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

function getTitle(mark_status_id: number): string {
    return tOr(`mark.title.${mark_status_id}`, "");
}

function getQuestion(mark_status_id: number): string {
    switch (mark_status_id) {
        case MarkStatusType.UnconfirmedStatus:
        case MarkStatusType.ConfirmedStatus:
        case MarkStatusType.RediscoveredStatus:
            return tOr("mark.question.exists", "");
        case MarkStatusType.UnderReviewStatus:
            return tOr("mark.question.solved", "");
    }
    return "";
}

function getDate(dateStr: string, locale: string): string {
    const date = new Date(dateStr)
    return date.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
}

/** How many checks a collapsed block shows whole before the reader asks for the rest. */
const COLLAPSED_CHECKS = 2;

function HistoryGroup({ group, depth, spanMs, isLast }: {
    group: MarkStatusHistoryItem[];
    depth: number;
    spanMs: number;
    isLast: boolean;
}) {
    const { t, lang } = useT();
    const [showChecks, setShowChecks] = useState(false);
    // `lang` re-renders the group when the language changes (titles/questions are read via tOr)
    void lang;

    const allChecks: Check[] = [];
    group.forEach(item => {
        allChecks.push(...item.checks!)
    });

    const confirmCount = allChecks.filter((check) => check.result).length;

    const question = getQuestion(group[group.length - 1].new_mark_status_id);

    // The stratum takes the colour of the status that opened this layer.
    const statusId = group[0].new_mark_status_id;
    const span = spanLabel(spanMs);
    const duration = `${span.value} ${t(`common.${span.unit}` as TranslationKey)}`;

    return (
        <li className="core__layer" style={{ minHeight: `${depth}px` }}>
            <div className="core__spine" aria-hidden="true">
                <div
                    className="core__stratum"
                    style={{ height: `${depth}px`, backgroundColor: STATUS_COLORS[statusId] ?? STATUS_FALLBACK }}
                />
            </div>
            <div className="core__body">
                {group.map((item, i) => (
                    <HistoryItem key={item.id} item={item} isFirst={i === 0} />
                ))}
                <p className="core__span">{t(isLast ? "mark.stillInStatus" : "mark.spentInStatus", { duration })}</p>
            {question !== "" &&
                <>
                    <div className="core__card">
                        <DoubleProgressBar
                            question={question}
                            negative={allChecks.length - confirmCount}
                            positive={confirmCount}
                        />
                    </div>
                    {allChecks.length > 0 &&
                        <div className="core__card checks">
                            <header className="checks__head">
                                <h3>{t("mark.checks")}</h3>
                                <span
                                    className="checks__tally"
                                    aria-label={t("mark.checksTally", { ok: confirmCount, no: allChecks.length - confirmCount })}
                                >
                                    <b className="ok">{confirmCount}</b>
                                    <i aria-hidden="true">/</i>
                                    <b className="no">{allChecks.length - confirmCount}</b>
                                </span>
                            </header>

                            {/* Collapsed shows the FIRST FEW CHECKS WHOLE rather than a strip of
                                every photograph with the checks taken apart: in that strip a check
                                without photos left no trace at all, though it is just as much a vote. */}
                            <ol className="checks__list">
                                {(showChecks ? allChecks : allChecks.slice(0, COLLAPSED_CHECKS)).map((check) => (
                                    <CheckItem key={check.check_id} check={check} />
                                ))}
                            </ol>

                            {allChecks.length > COLLAPSED_CHECKS &&
                                <button
                                    type="button"
                                    className="checks__more"
                                    aria-expanded={showChecks}
                                    onClick={() => setShowChecks(!showChecks)}
                                >
                                    {showChecks
                                        ? t("mark.checksCollapse")
                                        : t("mark.checksMore", { n: allChecks.length - COLLAPSED_CHECKS })}
                                </button>
                            }
                        </div>
                    }
                </>
            }
            </div>
        </li>
    )
}

/**
 * One status change inside a stratum. The first one names the layer; any child
 * changes under it are set quieter, because they are steps within that status
 * rather than new layers of their own.
 */
function HistoryItem({ item, isFirst }: { item: MarkStatusHistoryItem, isFirst: boolean }) {
    const { lang } = useT();
    return (
        <div className={isFirst ? "core__head" : "core__step"}>
            <p className={isFirst ? "core__title" : undefined}>{getTitle(item.new_mark_status_id)}</p>
            <p className="core__time">{getDate(item.changed_at, localeOf(lang))}</p>
        </div>
    )
}

/**
 * One check. The verdict is stated twice -- as the card's left rule and as a word
 * -- so it survives both a glance and a reader who cannot separate the two hues.
 */
const CheckItem = observer(function CheckItem({ check }: { check: Check }) {
    const { t, lang } = useT();
    return (
        <li className={`check check--${check.result ? "confirm" : "refute"}`}>
            <div className="check__top">
                <b className="check__author">{check.username}</b>
                <span className="check__verdict">{t(check.result ? "mark.confirmedBy" : "mark.refutedBy")}</span>
                <time className="check__time" dateTime={check.created_at}>{getDate(check.created_at, localeOf(lang))}</time>
            </div>
            {check.comment !== "" && <p className="check__comment">{check.comment}</p>}
            <div className="check__photos">
                {check.photos.length > 0
                    ? check.photos.map((src, index) => (
                        <img key={index} className="check__photo" src={src} alt="" />
                    ))
                    : <span className="check__nophotos">{t("mark.checkNoPhotos")}</span>
                }
            </div>
            {check.user_id !== user.id &&
                <div className="check__report">
                    <ReportButton targetType="check" targetId={check.check_id} small />
                </div>
            }
        </li>
    )
});
