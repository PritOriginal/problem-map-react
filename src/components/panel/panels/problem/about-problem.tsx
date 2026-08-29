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
import Arrow from "../../../arrow/arrow";
import markStatusesStore from "../../../../store/mark-statuses";
import notificationsStore from "../../../../store/notifications";
import marksStore from "../../../../store/marks";
import organizationsStore from "../../../../store/organizations";
import { TranslationKey, localeOf, tOr, useT } from "../../../../i18n";
import ReportButton from "../../../report/report-button";
import CommentsBlock from "./comments";
import { DuplicateBadge, HiddenBadge } from "../../../badges/badges";

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
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <ShareButton />
                {user.id !== 0 && mark.mark_id !== 0 && <FollowButton onDone={reload} />}
                {user.id !== 0 && mark.mark_id !== 0 && user.id !== mark.user_id && <ReportButton targetType="mark" targetId={mark.mark_id} />}
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
                    <p style={{ fontSize: 18 }}><b>{t("common.description")}</b></p>
                    <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{mark.description}</p>
                    <hr />
                </>
            }
            <p style={{ fontSize: 18 }}><b>{t("mark.history")}</b></p>
            <hr />
            {groups.map((group, index) => (
                <HistoryGroup key={index} group={group} />
            ))}
            {mark.mark_id !== 0 && <CommentsBlock />}
            {possibilityAddCheck &&
                <div style={{ position: "sticky", bottom: "0" }}>
                    <Button style="white-2-black" onClick={handleOnClickNewCheck}>
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
    style: "green" | "red";
}> = {
    confirm: {
        call: (id) => MarksService.confirmMark(id),
        question: "mark.confirmQuestion",
        errorText: "mark.confirmFailed",
        label: "mark.confirm",
        pendingLabel: "mark.confirming",
        style: "green",
    },
    reject: {
        call: (id) => MarksService.rejectMark(id),
        question: "mark.rejectQuestion",
        errorText: "mark.rejectFailed",
        label: "mark.reject",
        pendingLabel: "mark.rejecting",
        style: "red",
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
            <p style={{ fontSize: 18 }}><b>{t("mark.moderation")}</b></p>
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
        <Button style={following ? "black-2-white" : "white-2-black"} isMini disabled={pending} onClick={toggle}>
            {t(following ? "mark.following" : "mark.follow")}{count !== undefined && ` · ${count}`}
        </Button>
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
                marksStore.fetch();
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
            <p style={{ fontSize: 18 }}><b>{t("mark.mine")}</b></p>
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
                        <Button style="green" disabled={pending !== null} onClick={save}>
                            {t(pending === "save" ? "common.saving" : "common.save")}
                        </Button>
                        <Button style="white-2-black" disabled={pending !== null} onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
                    </div>
                </>
                :
                <div style={{ display: "flex", gap: "8px" }}>
                    <Button style="white-2-black" disabled={pending !== null} onClick={startEdit}>{t("common.edit")}</Button>
                    <Button style="red" disabled={pending !== null} onClick={remove}>
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
        <div>
            <Button style="white-2-black" isMini onClick={share}>
                {t(copied ? "mark.linkCopied" : "mark.share")}
            </Button>
        </div>
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

function HistoryGroup({ group }: { group: MarkStatusHistoryItem[] }) {
    const { t, lang } = useT();
    const [showChecks, setShowChecks] = useState(false);
    // `lang` re-renders the group when the language changes (titles/questions are read via tOr)
    void lang;

    const allChecks: Check[] = [];
    group.forEach(item => {
        allChecks.push(...item.checks!)
    });

    const question = getQuestion(group[group.length - 1].new_mark_status_id);

    return (
        <>
            {group.map((item) => (
                <HistoryItem key={item.id} item={item} />
            ))}
            {question !== "" &&
                <>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px", backgroundColor: "white" }}>
                        <DoubleProgressBar
                            question={question}
                            negative={allChecks.filter(check => check.result == false).length}
                            positive={allChecks.filter(check => check.result == true).length}
                        />
                    </div>
                    {allChecks.length > 0 &&
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "8px", backgroundColor: "white" }}>
                            <div style={{ display: "flex", gap: "16px", cursor: "pointer", justifyContent: "space-between" }} onClick={() => setShowChecks(!showChecks)}>
                                <p>{t("mark.checks")}</p>
                            </div>

                            {!showChecks ?
                                <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
                                    {allChecks.map((check) => (
                                        check.photos.map((photo) => (
                                            <ThumbPhoto key={`${check.check_id}-${photo}`} src={photo} confirmed={check.result} />
                                        ))
                                    ))}
                                </div>
                                :
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "8px", backgroundColor: "#f9f9f9" }}>
                                    {showChecks && allChecks.map((check) => (
                                        <CheckItem key={check.check_id} check={check} />
                                    ))}
                                </div>
                            }
                            < div >
                                <ShowButton
                                    isShow={showChecks}
                                    onClick={() => setShowChecks(!showChecks)}
                                />
                            </div >
                        </div>
                    }
                </>
            }
            <hr />
        </>
    )
}

function HistoryItem({ item }: { item: MarkStatusHistoryItem }) {
    const { lang } = useT();
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px", backgroundColor: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p>{getTitle(item.new_mark_status_id)}</p>
                <p style={{ fontSize: 12 }}>{getDate(item.changed_at, localeOf(lang))}</p>
            </div>
        </div>
    )
}

function ShowButton({ isShow, onClick }: { isShow: boolean, onClick: React.MouseEventHandler }) {
    return (
        <button
            className="show-button"
            onClick={onClick}
        >
            <Arrow className="arrow" isOpen={isShow} />
        </button>
    )
}
const CheckItem = observer(function CheckItem({ check }: { check: Check }) {
    const { t, lang } = useT();
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "8px", backgroundColor: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <p>{check.username}</p>
                <p style={{ fontSize: 12 }}>{new Date(check.created_at).toLocaleString(localeOf(lang))}</p>
            </div>
            {check.result
                ?
                <p style={{ fontSize: 12, color: "green" }}>{t("mark.confirmedBy")}</p>
                :
                <p style={{ fontSize: 12, color: "red" }}>{t("mark.refutedBy")}</p>
            }
            {check.comment !== "" && <>
                <p>{t("common.comment")}</p>
                <p style={{ fontSize: 14 }}>{check.comment}</p>
            </>}
            <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
                {check.photos.map((src, index) => (
                    <Photo key={index} src={src} />
                ))}
            </div>
            {check.user_id !== user.id && <div><ReportButton targetType="check" targetId={check.check_id} small /></div>}
        </div>
    )
});

function ThumbPhoto({ src, confirmed}: { src: string, confirmed: boolean }) {
    return (
        <img className={`thumb-photo ${confirmed ? "confirm" : "reject"}`} src={src} alt="" />
    )
}

function Photo({ src }: { src: string }) {
    return (
        <img className="photo" src={src} alt="" />
    )
}   