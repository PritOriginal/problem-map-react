import { useEffect, useRef, useState } from "react";
import { useT } from "../../../i18n";
import MarksService, { AddMarkRequest, SimilarMark, toApiPoint } from "../../../services/MarksService";
import SimilarMarksBlock from "../../similar-marks/similar-marks";
import { parseSimilarMarks, similarMarksFromError } from "../../../utils/similar";
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
import offlineQueueStore from "../../../store/offline-queue";
import { toQueuedPhotos } from "../../../offline/queue";
import { TypeIcon } from "../../mark/mark";
import { typeColor } from "../../../utils/mark-types";
import { MARKER_ICON } from "../../../styles/tokens";
import "./add-problem.scss";

const AddProblem = observer(function AddProblem() {
    const { isMobile } = useDeviceDetect();
    const { t } = useT();

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

    const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
    const selectedMarkType = markTypesStore.types.find((type) => type.mark_type_id === selectedTypeId);

    const [description, setDescription] = useState("")
    const [photos, setPhotos] = useState<File[]>([]);

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
        offlineQueueStore.sendOrEnqueue(
            { kind: "mark", longitude: req.point.longitude, latitude: req.point.latitude, mark_type_id: req.mark_type_id, description: req.description, force, photos: toQueuedPhotos(photos) },
            (key) => MarksService.addMark(req, photos, force, key),
        )
            .then((res) => {
                notificationsStore.clear();
                setSimilar([]);
                panelStore.setOpen(false);
                if (res.queued) {
                    notificationsStore.showError(null, t("offline.markQueued"));
                    navigate("/queue");
                    return;
                }
                marksStore.fetch();
                navigate(`/problem/${res.result.payload.mark_id}`);
            })
            .catch((error) => {
                const conflict = similarMarksFromError(error);
                if (conflict.length > 0) {
                    setSimilar(conflict);
                    return;
                }
                console.error(error);
                notificationsStore.showError(error, t("addMark.failed"));
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
        if (!navigator.onLine) {
            submit(req, false); // no similarity check offline: the backend re-checks when the queue is sent
            return;
        }
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

    // `buildRequest` refuses without a category or a photo. That rule was invisible:
    // the button stayed enabled and a press did nothing at all. Now it is stated.
    const missing = selectedMarkType === undefined
        ? (photos.length === 0 ? t("addMark.needBoth") : t("addMark.needCategory"))
        : photos.length === 0 ? t("addMark.needPhoto") : null;

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
                <h1 className="panel__header__title">{t("addMark.title")}</h1>
                <p className="panel__header__coords">
                    <span className="visually-hidden">{t("common.coordinates")}: </span>
                    {selectedPoint.coords[1].toFixed(6)}, {selectedPoint.coords[0].toFixed(6)}
                </p>
            </div>
            <div className="panel__content">
                {user.id === 0 ?
                    <UnauthorizedBlock
                        text={t("unauth.addMark")}
                    />
                    :
                    <>
                        <div className="mark-form">
                            <div className="mark-form__field">
                                {/* The category as a list, not a dropdown: there are five,
                                    each carries an icon and a colour, and a list shows all
                                    of them at once. It also takes react-select off this
                                    screen -- the library paints its own colours inline and
                                    stayed white under the dark theme. */}
                                <span className="mark-form__label" id="mark-category-label">
                                    {t("common.category")}
                                    <i className="mark-form__required">{t("common.required")}</i>
                                </span>
                                {markTypesStore.types.length === 0
                                    ? <p className="empty-state">{t("common.loading")}</p>
                                    : <div className="category-list" role="group" aria-labelledby="mark-category-label">
                                        {markTypesStore.types.map((type) => (
                                            <button
                                                key={type.mark_type_id}
                                                type="button"
                                                className="category-list__item"
                                                aria-pressed={type.mark_type_id === selectedTypeId}
                                                onClick={() => setSelectedTypeId(type.mark_type_id)}
                                            >
                                                <span
                                                    className={`category-list__glyph${typeColor(type) ? " icon-on-fill" : ""}`}
                                                    style={typeColor(type) ? { backgroundColor: typeColor(type) } : undefined}
                                                >
                                                    <TypeIcon typeId={type.mark_type_id} type={type} color={typeColor(type) ? MARKER_ICON : "var(--ink)"} />
                                                </span>
                                                {type.name}
                                            </button>
                                        ))}
                                    </div>
                                }
                            </div>

                            <div className="mark-form__field">
                                <span className="mark-form__label" id="mark-photos-label">
                                    {t("common.photos")}
                                    <i className="mark-form__required">{t("common.required")}</i>
                                </span>
                                <p className="mark-form__note">{t("addMark.photosNote")}</p>
                                <div role="group" aria-labelledby="mark-photos-label">
                                    <SelectFiles files={photos} onChange={setPhotos} />
                                </div>
                            </div>

                            <label className="mark-form__field">
                                <span className="mark-form__label">
                                    {t("common.description")}
                                    <i className="mark-form__optional">{t("common.optional")}</i>
                                </span>
                                <textarea
                                    className="edit-multiline-text"
                                    name="description"
                                    value={description}
                                    placeholder={t("addMark.descriptionPlaceholder")}
                                    rows={3}
                                    onChange={(e) => { setDescription(e.target.value) }}
                                ></textarea>
                            </label>

                            {similar.length > 0 ?
                                <SimilarMarksBlock
                                    marks={similar}
                                    pending={pending}
                                    onPick={pickSimilar}
                                    onForce={forceAdd}
                                    onCancel={() => setSimilar([])}
                                />
                                :
                                <>
                                    {/* Named the moment it is needed, not after a press that
                                        looks like a broken button. */}
                                    {missing !== null && <p className="mark-form__hint">{missing}</p>}
                                    <button
                                        type="button"
                                        className="mark-form__submit"
                                        disabled={pending || missing !== null}
                                        onClick={addMark}
                                    >
                                        {pending ? t("addMark.checking") : t("addMark.title")}
                                    </button>
                                </>
                            }
                        </div>
                    </>
                }
            </div>
        </>
    )
});

export default AddProblem;