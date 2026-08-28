import { useEffect, useRef, useState } from "react";
import MarksService, { AddMarkRequest, MarkType } from "../../../services/MarksService";
import Select from 'react-select';
import { Button } from "../../button/button";
import { observer } from "mobx-react-lite";
import selectedPoint from "../../../store/selected_point";
import { useNavigateKeepSearch } from "../../../utils/navigation";
import SelectFiles from "../../SelectFiles";
import marksStore from "../../../store/marks";
import user from "../../../store/user";
import UnauthorizedBlock from "../../unauthorized-block/unauthorized-block";
import markTypesStore from "../../../store/mark-types";
import panelStore from "../../../store/panel";
import notificationsStore from "../../../store/notifications";
import { useDeviceDetect } from "../../../utils/hooks";

const AddProblem = observer(function AddProblem() {
    const { isMobile } = useDeviceDetect();

    const panelHeaderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (panelHeaderRef.current) {
            if (isMobile) {
                panelStore.setHeight(0)
            } else {
                panelStore.setHeight(panelHeaderRef.current.offsetHeight);
            }
        }
    }, [isMobile]);

    const navigate = useNavigateKeepSearch();

    const markTypesOptions = markTypesStore.types.map((type) => ({
        value: type.mark_type_id,
        label: type.name,
    }))

    const [selectedMarkType, setSelectedMarkType] = useState<undefined | MarkType>(undefined)
    const selectedMarkTypeOption = markTypesOptions.find(v => v.value === selectedMarkType?.mark_type_id);

    const [description, setDescription] = useState("")
    const [photos, setPhotos] = useState<File[]>([]);

    const onSelectedFile = (files: File[]) => {
        setPhotos(files);
    }

    const addMark = () => {
        if (selectedMarkType && photos.length > 0) {
            const req: AddMarkRequest = {
                // ВНИМАНИЕ: намеренная «перестановка». selectedPoint.coords — ymaps3 LngLat = [lng, lat].
                // Бэкенд (handler/marks AddMark) собирает точку как geom.Coord{Latitude, Longitude},
                // т.е. кладёт поле latitude в X (долгота), а longitude — в Y (широта). Чтобы в БД
                // оказалась корректная точка (X=lng, Y=lat), сюда нужно отправлять поля крест-накрест.
                // Если бэкенд исправят на Coord{Longitude, Latitude} — здесь надо поменять индексы местами.
                point: {
                    longitude: selectedPoint.coords[1],
                    latitude: selectedPoint.coords[0]
                },
                mark_type_id: selectedMarkType.mark_type_id,
                description: description
            }

            MarksService.addMark(req, photos)
                .then((data) => {
                    notificationsStore.clear();
                    marksStore.fetch();
                    panelStore.setOpen(false);
                    navigate(`/problem/${data.payload.mark_id}`);
                })
                .catch((error) => {
                    console.error(error);
                    notificationsStore.showError(error, "Не удалось отметить проблему");
                })
        }
    }

    return (
        <>
            <div
                ref={panelHeaderRef}
                className="panel__header"
                onClick={() => panelStore.toggle()}
            >
                <p><b>Отметить проблему</b></p>
            </div>
            <div className="panel__content">
                {user.id === 0 ?
                    <UnauthorizedBlock
                        text="Для того чтобы отметить проблему, авторизуйтесь или создайте новый аккаунт"
                    />
                    :
                    <>
                        <p style={{ fontSize: 12 }}>Координаты: {selectedPoint.coords[1].toFixed(6)}, {selectedPoint.coords[0].toFixed(6)}</p>

                        <p><b>Категория</b></p>
                        <Select
                            options={markTypesOptions}
                            value={selectedMarkTypeOption === undefined ? null : selectedMarkTypeOption}
                            placeholder={"Выберите категорию проблемы"}
                            onChange={(val) => { setSelectedMarkType(markTypesStore.types.find(type => type.mark_type_id === val?.value)) }}
                            isDisabled={markTypesStore.types.length === 0}
                        />
                        <p><b>Описание</b></p>
                        <textarea
                            className="edit-multiline-text"
                            name="description"
                            value={description}
                            onChange={(e) => { setDescription(e.target.value) }}
                        ></textarea>
                        <p><b>Фотографии</b></p>
                        <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
                            <SelectFiles onSelectedFiles={onSelectedFile} />
                        </div>
                        <div>
                            <Button style="white-2-black" onClick={addMark}>
                                <p>Отметить</p>
                            </Button>
                        </div>
                    </>
                }
            </div>
        </>
    )
});

export default AddProblem;