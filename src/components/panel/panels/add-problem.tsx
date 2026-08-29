import { useEffect, useRef, useState } from "react";
import MarksService, { AddMarkRequest, MarkType, SimilarMark, toApiPoint } from "../../../services/MarksService";
import SimilarMarksBlock from "../../similar-marks/similar-marks";
import { parseSimilarMarks, similarMarksFromError } from "../../../utils/similar";
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

    const [similar, setSimilar] = useState<SimilarMark[]>([]);
    const [pending, setPending] = useState(false);

    const buildRequest = (): AddMarkRequest | null => {
        if (!selectedMarkType || photos.length === 0) {
            return null;
        }
        return {
            point: toApiPoint(selectedPoint.coords),
            mark_type_id: selectedMarkType.mark_type_id,
            description: description
        };
    }

    /** Sends the mark; a 409 with `similar_marks` shows the similar block instead of an error. */
    const submit = (req: AddMarkRequest, force: boolean) => {
        setPending(true);
        MarksService.addMark(req, photos, force)
            .then((data) => {
                notificationsStore.clear();
                setSimilar([]);
                marksStore.fetch();
                panelStore.setOpen(false);
                navigate(`/problem/${data.payload.mark_id}`);
            })
            .catch((error) => {
                const conflict = similarMarksFromError(error);
                if (conflict.length > 0) {
                    setSimilar(conflict);
                    return;
                }
                console.error(error);
                notificationsStore.showError(error, "Не удалось отметить проблему");
            })
            .finally(() => setPending(false));
    }

    /** Checks `GET /marks/similar` first; creates the mark when nothing similar is nearby. */
    const addMark = () => {
        const req = buildRequest();
        if (!req) {
            return;
        }
        setPending(true);
        MarksService.getSimilarMarks({ point: req.point, mark_type_id: req.mark_type_id })
            .then((data) => {
                const found = parseSimilarMarks(data.payload);
                if (found.length > 0) {
                    setSimilar(found);
                    setPending(false);
                    return;
                }
                submit(req, false);
            })
            .catch((error) => {
                // the similarity check is best-effort: the backend re-checks on POST and answers 409
                console.error(error);
                submit(req, false);
            });
    }

    const forceAdd = () => {
        const req = buildRequest();
        if (req) {
            submit(req, true);
        }
    }

    const pickSimilar = (mark: SimilarMark) => {
        setSimilar([]);
        panelStore.setOpen(false);
        navigate(`/problem/${mark.mark_id}`);
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
                        {similar.length > 0 ?
                            <SimilarMarksBlock
                                marks={similar}
                                pending={pending}
                                onPick={pickSimilar}
                                onForce={forceAdd}
                                onCancel={() => setSimilar([])}
                            />
                            :
                            <div>
                                <Button style="white-2-black" disabled={pending} onClick={addMark}>
                                    <p>{pending ? "Проверяем…" : "Отметить"}</p>
                                </Button>
                            </div>
                        }
                    </>
                }
            </div>
        </>
    )
});

export default AddProblem;