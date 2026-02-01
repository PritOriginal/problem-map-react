import { useContext, useEffect, useState } from "react";
import { Mark, MarkStatus, MarkType } from "../../../../services/MarksService";
import { Button } from "../../../button/button";
import DoubleProgressBar from "../../../double-progress-bar/double-progress-bar";
import { COLOR_MARK_STATUSES, TypeMarkIcons } from "../../../mark/mark";
import { useNavigate, useParams } from "react-router-dom";
import MarksService from "../../../../services/MarksService";
import ChecksService, { Check } from "../../../../services/ChecksService";
import { MarkContext } from "./problem";

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

    const [checks, setChecks] = useState<Check[]>([])

    var createdAtStr = ""
    if (mark.created_at !== "") {
        const createdAt = new Date(mark.created_at)
        createdAtStr = `${createdAt.toLocaleDateString()} ${createdAt.getHours()}:${createdAt.getMinutes()}`
    }

    useEffect(() => {
        if (mark.mark_id !== 0) {
            ChecksService.getChecksByMarkId(mark.mark_id)
                .then((data) => {
                    console.log(data.payload.checks);
                    setChecks(data.payload.checks)
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
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px", backgroundColor: "white" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <p>Проблема создана</p>
                    <p style={{ fontSize: 12 }}>{createdAtStr}</p>
                </div>
                <DoubleProgressBar
                    negative={checks.filter(check => check.result == false).length}
                    positive={checks.filter(check => check.result == true).length}
                />
                <Button style="white-2-black" onClick={handleOnClickNewCheck}>
                    Опровергнуть | Подтвердить
                </Button>
            </div>

            <hr />

            {checks.map((check, index) => (
                <CheckItem key={index} check={check} />
            ))}
        </>
    );
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
            <div style={{ display: "flex", gap: "8px" }}>
                {check.photos.map((src, index) => (
                    <Photo key={index} src={src} />
                ))}
            </div>
        </div>
    )
}

function Photo({ src }: { src: string }) {
    return (
        <img className="photo" src={src} alt="" />
    )
}