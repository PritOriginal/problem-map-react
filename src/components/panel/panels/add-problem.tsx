import { useEffect, useState } from "react";
import MapService, { MarkType } from "../../../services/MapService";
import Select from 'react-select';
import { Button } from "../../button/button";


export default function AddProblem() {
    const [markTypes, setMarkTypes] = useState<MarkType[]>([])

    const markTypesOptions = markTypes.map((type) => ({
        value: type.type_mark_id,
        label: type.name,
    }))

    const [selectedMarkType, setSelectedMarkType] = useState<undefined | MarkType>(undefined)
    const selectedMarkTypeOption = markTypesOptions.find(v => v.value === selectedMarkType?.type_mark_id);

    const [description, setDescription] = useState("")

    useEffect(() => {
        MapService.getMarkTypes()
            .then((data) => {
                console.log(data.payload.mark);
                setMarkTypes(data.payload.mark_types)
            })
            .catch((error) => {
                console.log(error);
            })
    }, [])

    return (
        <>
            <div className="panel__header">
                <p style={{ fontSize: 18 }}>Отметить проблему</p>
            </div>
            <div className="panel__content">
                <p style={{ fontSize: 12 }}>Координаты: 40.96110892973163, 52.54600597551669</p>

                <p><b>Категория</b></p>
                <Select
                    options={markTypesOptions}
                    value={selectedMarkTypeOption === undefined ? null : selectedMarkTypeOption}
                    placeholder={"Выберите категорию проблемы"}
                    onChange={(val) => { setSelectedMarkType(markTypes.find(type => type.type_mark_id === val?.value)) }}
                    isDisabled={markTypes.length === 0}
                />
                <p><b>Описание</b></p>
                <textarea
                    className="edit-multiline-text"
                    name="description"
                    value={description}
                    onChange={(e) => { setDescription(e.target.value) }}
                ></textarea>
                <p><b>Фотографии</b></p>
                <div style={{ display: "flex", gap: "8px" }}>
                    <div className="photo add">+</div>
                    <div className="photo"></div>
                </div>
                <div>
                    <Button style="white-2-black">
                        <p>Отметить</p>
                    </Button>
                </div>
            </div>
        </>
    )
}