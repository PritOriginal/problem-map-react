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

const AboutProblem = observer(function AboutProblem() {
    const navigate = useNavigateKeepSearch();

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
            mark.mark_status_id == MarkStatusType.RefutedStatus) {
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
                notificationsStore.showError(error, "Не удалось загрузить историю проблемы");
            });
        return () => {
            ignore = true;
        };
    }, [mark])

    const handleOnClickNewCheck = () => {
        navigate(`/problem/${mark.mark_id}/add-check`)
    }

    return (
        <>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <ShareButton />
                {user.id !== 0 && mark.mark_id !== 0 && <FollowButton onDone={reload} />}
            </div>
            {user.isModerator && mark.mark_id !== 0 && <ModerationBlock onDone={reload} />}
            {user.id !== 0 && user.id === mark.user_id && mark.mark_status_id === MarkStatusType.UnconfirmedStatus && <OwnerBlock onDone={reload} />}
            {mark.description !== "" &&
                <>
                    <p style={{ fontSize: 18 }}><b>Описание</b></p>
                    <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{mark.description}</p>
                    <hr />
                </>
            }
            <p style={{ fontSize: 18 }}><b>История</b></p>
            <hr />
            {groups.map((group, index) => (
                <HistoryGroup key={index} group={group} />
            ))}
            {possibilityAddCheck &&
                <div style={{ position: "sticky", bottom: "0" }}>
                    <Button style="white-2-black" onClick={handleOnClickNewCheck}>
                        Опровергнуть | Подтвердить
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
    question: string;
    errorText: string;
    label: string;
    pendingLabel: string;
    style: "green" | "red";
}> = {
    confirm: {
        call: (id) => MarksService.confirmMark(id),
        question: "Подтвердить проблему №{id}?",
        errorText: "Не удалось подтвердить проблему",
        label: "Подтвердить",
        pendingLabel: "Подтверждаем…",
        style: "green",
    },
    reject: {
        call: (id) => MarksService.rejectMark(id),
        question: "Отклонить проблему №{id}?",
        errorText: "Не удалось отклонить проблему",
        label: "Отклонить",
        pendingLabel: "Отклоняем…",
        style: "red",
    },
};

function ModerationBlock({ onDone }: { onDone: () => void }) {
    const mark = useContext(MarkContext);
    const [pending, setPending] = useState<ModerationAction | null>(null);

    if (!MODERATABLE_STATUSES.includes(mark.mark_status_id)) {
        return null;
    }

    const moderate = (action: ModerationAction) => {
        const spec = MODERATION_ACTIONS[action];
        if (!window.confirm(spec.question.replace("{id}", String(mark.mark_id)))) {
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
                notificationsStore.showError(error, spec.errorText);
            })
            .finally(() => setPending(null));
    };

    return (
        <>
            <p style={{ fontSize: 18 }}><b>Модерация</b></p>
            <div style={{ display: "flex", gap: "8px" }}>
                {(Object.keys(MODERATION_ACTIONS) as ModerationAction[]).map((action) => (
                    <Button key={action} style={MODERATION_ACTIONS[action].style} disabled={pending !== null} onClick={() => moderate(action)}>
                        {pending === action ? MODERATION_ACTIONS[action].pendingLabel : MODERATION_ACTIONS[action].label}
                    </Button>
                ))}
            </div>
            <hr />
        </>
    );
}

/** "Слежу" toggle with the followers counter (`POST/DELETE /marks/{id}/follow`). */
const FollowButton = observer(function FollowButton({ onDone }: { onDone: () => void }) {
    const mark = useContext(MarkContext);
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
                notificationsStore.showError(error, following ? "Не удалось отписаться" : "Не удалось подписаться");
            })
            .finally(() => setPending(false));
    };

    return (
        <Button style={following ? "black-2-white" : "white-2-black"} isMini disabled={pending} onClick={toggle}>
            {following ? "Слежу" : "Следить"}{count !== undefined && ` · ${count}`}
        </Button>
    );
});

/** Owner-only actions for an unconfirmed mark: edit description/type, delete. */
const OwnerBlock = observer(function OwnerBlock({ onDone }: { onDone: () => void }) {
    const mark = useContext(MarkContext);
    const navigate = useNavigateKeepSearch();
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
                notificationsStore.showError(error, "Не удалось сохранить изменения");
            })
            .finally(() => setPending(null));
    };

    const remove = () => {
        if (!window.confirm(`Удалить проблему №${mark.mark_id}? Это действие нельзя отменить.`)) {
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
                notificationsStore.showError(error, "Не удалось удалить проблему");
                setPending(null);
            });
    };

    const options = markTypesStore.types.map((t: MarkType) => ({ value: t.mark_type_id, label: t.name }));

    return (
        <>
            <p style={{ fontSize: 18 }}><b>Моя метка</b></p>
            {editing ?
                <>
                    <p><b>Категория</b></p>
                    <Select
                        options={options}
                        value={options.find((o) => o.value === typeId) ?? null}
                        onChange={(val) => { if (val) { setTypeId(val.value); } }}
                        isDisabled={options.length === 0}
                    />
                    <p><b>Описание</b></p>
                    <textarea
                        className="edit-multiline-text"
                        name="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    ></textarea>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <Button style="green" disabled={pending !== null} onClick={save}>
                            {pending === "save" ? "Сохраняем…" : "Сохранить"}
                        </Button>
                        <Button style="white-2-black" disabled={pending !== null} onClick={() => setEditing(false)}>Отмена</Button>
                    </div>
                </>
                :
                <div style={{ display: "flex", gap: "8px" }}>
                    <Button style="white-2-black" disabled={pending !== null} onClick={startEdit}>Редактировать</Button>
                    <Button style="red" disabled={pending !== null} onClick={remove}>
                        {pending === "delete" ? "Удаляем…" : "Удалить"}
                    </Button>
                </div>
            }
            <hr />
        </>
    );
});

function ShareButton() {
    const [copied, setCopied] = useState(false);
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const share = async () => {
        const url = window.location.href;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
            } else if (window.prompt("Скопируйте ссылку", url) === null) {
                return;
            }
            setCopied(true);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error(error);
            notificationsStore.showError(error, "Не удалось скопировать ссылку");
        }
    };

    return (
        <div>
            <Button style="white-2-black" isMini onClick={share}>
                {copied ? "Ссылка скопирована" : "Поделиться"}
            </Button>
        </div>
    );
}

function getTitle(mark_status_id: number): string {
    let title: string = "";
    switch (mark_status_id) {
        case MarkStatusType.UnconfirmedStatus:
            title = "Проблема отмечена";
            break;
        case MarkStatusType.ConfirmedStatus:
            title = "Проблема подтверждена";
            break;
        case MarkStatusType.UnderReviewStatus:
            title = "Проблема на проверке";
            break;
        case MarkStatusType.RediscoveredStatus:
            title = "Проблема переоткрыта";
            break;
        case MarkStatusType.ClosedStatus:
            title = "Проблема решена";
            break;
        case MarkStatusType.RefutedStatus:
            title = "Проблема опровергнута";
            break;
    }
    return title
}

function getQuestion(mark_status_id: number): string {
    let question: string = "";
    switch (mark_status_id) {
        case MarkStatusType.UnconfirmedStatus:
            question = "Проблема существует?";
            break;
        case MarkStatusType.ConfirmedStatus:
            question = "Проблема существует?";
            break;
        case MarkStatusType.UnderReviewStatus:
            question = "Проблема решена?";
            break;
        case MarkStatusType.RediscoveredStatus:
            question = "Проблема существует?";
            break;
    }
    return question
}

function getDate(dateStr: string): string {
    const date = new Date(dateStr)
    return `${date.toLocaleDateString()} ${date.getHours()}:${date.getMinutes()}`;
}

function HistoryGroup({ group }: { group: MarkStatusHistoryItem[] }) {
    const [showChecks, setShowChecks] = useState(false);

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
                                <p>Проверки</p>
                            </div>

                            {!showChecks ?
                                <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
                                    {allChecks.map((check) => (
                                        check.photos.map((photo) => (
                                            <ThumbPhoto src={photo} confirmed={check.result} />
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
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px", backgroundColor: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p>{getTitle(item.new_mark_status_id)}</p>
                <p style={{ fontSize: 12 }}>{getDate(item.changed_at)}</p>
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
function CheckItem({ check }: { check: Check }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "8px", backgroundColor: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <p>{check.username}</p>
                <p style={{ fontSize: 12 }}>{new Date(check.created_at).toLocaleString()}</p>
            </div>
            {check.result
                ?
                <p style={{ fontSize: 12, color: "green" }}>Подтвердил</p>
                :
                <p style={{ fontSize: 12, color: "red" }}>Опроверг</p>
            }
            {check.comment !== "" && <>
                <p>Комментарий</p>
                <p style={{ fontSize: 14 }}>{check.comment}</p>
            </>}
            <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
                {check.photos.map((src, index) => (
                    <Photo key={index} src={src} />
                ))}
            </div>
        </div>
    )
}

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