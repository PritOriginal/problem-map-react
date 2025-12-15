import { useEffect, useState } from "react";
import { MarkStatus, MarkType } from "../../../services/MarksService";
import { Button } from "../../button/button";
import DoubleProgressBar from "../../double-progress-bar/double-progress-bar";
import { COLOR_MARK_STATUSES, Mark, TypeMarkIcons } from "../../mark/mark";
import { useParams } from "react-router-dom";
import MarksService from "../../../services/MarksService";

const emptyMark: Mark = {
    mark_id: 0,
    name: "",
    geom: {
        type: "Point",
        coordinates: [0, 0]
    },
    type_mark_id: 1,
    user_id: 0,
    district_id: 0,
    number_votes: 0,
    number_checks: 0,
    mark_status_id: 0
}

const checks = [
    { res: true, photos: ["1"] },
    { res: false, photos: ["1", "2"] },
]

export default function AboutProblem() {
    const params = useParams();

    const [mark, setMark] = useState<Mark>(emptyMark);
    const [markTypes, setMarkTypes] = useState<MarkType[]>([])
    const [markStatuses, setMarkStatuses] = useState<MarkStatus[]>([])

    const markType: MarkType | undefined = mark.type_mark_id !== 0 ? markTypes.find((type) => type.type_mark_id == mark.type_mark_id) : { type_mark_id: 0, name: "" } as MarkType;
    const markStatus = mark.mark_status_id !== 0 ? markStatuses.find((status) => status.mark_status_id == mark.mark_status_id) : { mark_status_id: 0, name: "Статус" };

    useEffect(() => {
        MarksService.getMarkById(Number(params.id))
            .then((data) => {
                console.log(data.payload.mark);
                setMark(data.payload.mark)
            })
            .catch((error) => {
                console.log(error);
            })
    }, [params])

    useEffect(() => {
        MarksService.getMarkTypes()
            .then((data) => {
                console.log(data.payload.mark_types);
                setMarkTypes(data.payload.mark_types)
            })
            .catch((error) => {
                console.log(error);
            })
        MarksService.getMarkStatuses()
            .then((data) => {
                console.log(data.payload.mark_statuses);
                setMarkStatuses(data.payload.mark_statuses)
            })
            .catch((error) => {
                console.log(error);
            })
    }, [])

    return (
        <>
            <div className="panel__header">
                <p style={{ fontSize: "12px" }}>№{mark.mark_id}</p>
                <div className="panel__header__status">
                    <div style={{ border: `2px solid ${COLOR_MARK_STATUSES[markStatus?.mark_status_id!]}`, backgroundColor: "#fff", borderRadius: "4px", padding: "4px" }}>
                        <p style={{ color: "#000" }}><b>{markStatus?.name}</b></p>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {TypeMarkIcons[mark.type_mark_id]({ color: "#fff" })}
                    <p style={{ fontSize: 18 }}><b>{markType?.name}</b></p>
                </div>
                <p style={{ fontSize: 12 }}>Координаты: <b>{mark.geom.coordinates[0]}, {mark.geom.coordinates[1]}</b></p>
            </div>
            <div className="panel__content">
                <p style={{ fontSize: 18 }}><b>История</b></p>
                <hr />
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px", backgroundColor: "white" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <p>Проблема создана</p>
                        <p style={{ fontSize: 12 }}>12:00 12.11.2025</p>
                    </div>
                    <DoubleProgressBar negative={1} positive={2} />
                    <Button style="white-2-black">
                        Опровергнуть | Подтвердить
                    </Button>
                </div>

                <hr />

                {checks.map((check, index) => (
                    <Check key={index} res={check.res} photos={check.photos} />
                ))}
            </div>
        </>
    );
}

function Check({ res, photos }: { res: boolean, photos: string[] }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "8px", backgroundColor: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <p>Пользователь 1</p>
                <p style={{ fontSize: 12 }}>12:00  12.11.2025</p>
            </div>
            {res
                ?
                <p style={{ fontSize: 12, color: "green" }}>Подтвердил</p>
                :
                <p style={{ fontSize: 12, color: "red" }}>Опроверг</p>
            }
            <div style={{ display: "flex", gap: "8px" }}>
                {photos.map((_, index) => (
                    <Photo key={index} />
                ))}
            </div>
        </div>
    )
}

function Photo() {
    return (
        <div className="photo"></div>
    )
}