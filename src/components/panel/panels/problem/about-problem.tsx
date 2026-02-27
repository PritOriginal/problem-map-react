import { useContext, useEffect, useState } from "react";
import MarksService, { Mark, MarkStatusHistoryItem, MarkStatusType } from "../../../../services/MarksService";
import { Button } from "../../../button/button";
import DoubleProgressBar from "../../../double-progress-bar/double-progress-bar";
import { useNavigate } from "react-router-dom";
import { Check } from "../../../../services/ChecksService";
import { MarkContext } from "./problem";
import user from "../../../../store/user";
import Arrow from "../../../arrow/arrow";
import markStatusesStore from "../../../../store/mark-statuses";

export const emptyMark: Mark = {
    mark_id: 0,
    name: "",
    geom: {
        type: "Point",
        coordinates: [0, 0]
    },
    mark_type_id: 1,
    user_id: 0,
    district_id: 0,
    number_votes: 0,
    number_checks: 0,
    mark_status_id: 0,
    created_at: "",
    updated_at: ""
}

export default function AboutProblem() {
    const navigate = useNavigate();

    const mark = useContext(MarkContext)
    const [historyItems, setHistoryItems] = useState<MarkStatusHistoryItem[]>([])

    const groups: MarkStatusHistoryItem[][] = []
    let groupHistoryItems: MarkStatusHistoryItem[] = []
    for (let index = historyItems.length - 1; index >= 0; index--) {
        const historyItem = historyItems[index];
        const markStatus = markStatusesStore.statuses.find((satus) => satus.mark_status_id == historyItem.new_mark_status_id);

        groupHistoryItems.unshift(historyItem);
        if (markStatus && markStatus.parent_id) {
        } else {
            groups.unshift(groupHistoryItems);
            groupHistoryItems = [];
        }
    }

    var possibilityAddCheck = true;
    if (user.id != 0 && historyItems.length > 0) {
        const lastGroupHistoryItems = groups[groups.length - 1]
        lastGroupHistoryItems.forEach(item => {
            const checks = item.checks;
            const findCheck = checks?.find((check) => { return check.user_id == user.id })
            if (findCheck) {
                possibilityAddCheck = false
            }
        });
    }

    let createdAtStr = ""
    if (mark.created_at !== "") {
        const createdAt = new Date(mark.created_at)
        createdAtStr = `${createdAt.toLocaleDateString()} ${createdAt.getHours()}:${createdAt.getMinutes()}`
    }

    useEffect(() => {
        if (mark.mark_id !== 0) {
            MarksService.getMarkStatusHistoryByMarkId(mark.mark_id, true)
                .then((data) => {
                    console.log(data.payload.items);
                    setHistoryItems(data.payload.items);
                })
                .catch((error) => {
                    console.log(error);
                })
        }
    }, [mark])

    const handleOnClickNewCheck = () => {
        navigate(`/problem/${mark.mark_id}/add-check`)
    }

    return (
        <>
            <p style={{ fontSize: 18 }}><b>История</b></p>
            <hr />
            {groups.map((group, index) => (
                <HistoryItem key={index} group={group} />
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

function getDate(dateStr: string): string {
    const date = new Date(dateStr)
    return `${date.toLocaleDateString()} ${date.getHours()}:${date.getMinutes()}`;
}

function HistoryItem({ group }: { group: MarkStatusHistoryItem[] }) {
    const [showChecks, setShowChecks] = useState(false);

    const allChecks: Check[] = [];
    group.forEach(item => {
        allChecks.push(...item.checks!)
    });

    return (
        <>
            {group.map((item, index) => (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px", backgroundColor: "white" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <p>{getTitle(item.new_mark_status_id)}</p>
                        <p style={{ fontSize: 12 }}>{getDate(item.changed_at)}</p>
                    </div>
                </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px", backgroundColor: "white" }}>
                <DoubleProgressBar
                    negative={allChecks.filter(check => check.result == false).length}
                    positive={allChecks.filter(check => check.result == true).length}
                />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "8px", backgroundColor: "white" }}>
                <div style={{ display: "flex", gap: "16px", cursor: "pointer", justifyContent: "space-between" }} onClick={() => setShowChecks(!showChecks)}>
                    <p>Проверки</p>
                </div>

                {!showChecks ?
                    <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
                        {allChecks.map((check) => (
                            check.photos.map((photo) => (
                                <ThumbPhoto src={photo} />
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
            <hr />
        </>
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

function ThumbPhoto({ src }: { src: string }) {
    return (
        <img className="thumb-photo" src={src} alt="" />
    )
}

function Photo({ src }: { src: string }) {
    return (
        <img className="photo" src={src} alt="" />
    )
}   