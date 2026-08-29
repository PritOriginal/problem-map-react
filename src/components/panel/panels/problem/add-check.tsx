import { useContext, useState } from "react";
import { useT } from "../../../../i18n";
import { Button } from "../../../button/button";
import { observer } from "mobx-react-lite";
import ChecksService, { AddCheckRequest } from "../../../../services/ChecksService";
import { MarkContext } from "./mark-context";
import { useNavigateKeepSearch } from "../../../../utils/navigation";
import SelectFiles from "../../../SelectFiles";
import user from "../../../../store/user";
import UnauthorizedBlock from "../../../unauthorized-block/unauthorized-block";
import marksStore from "../../../../store/marks";
import adminBoundariesStore from "../../../../store/admin-boundaries";
import notificationsStore from "../../../../store/notifications";
import offlineQueueStore from "../../../../store/offline-queue";
import tasksStore from "../../../../store/tasks";
import { toQueuedPhotos } from "../../../../offline/queue";

const AddCheck = observer(function AddCheck() {
    const navigate = useNavigateKeepSearch();
    const { t } = useT();

    const mark = useContext(MarkContext)

    const [comment, setComment] = useState("")
    const [photos, setPhotos] = useState<File[]>([]);
    const [pending, setPending] = useState(false);

    const onSelectedFile = (files: File[]) => {
        setPhotos(files);
    }

    const checkValidate = () => {
        return photos.length > 0
    }

    const addCheck = (result: boolean) => {
        if (checkValidate()) {
            const req: AddCheckRequest = {
                mark_id: mark.mark_id,
                result: result,
                comment: comment
            }

            setPending(true);
            offlineQueueStore.sendOrEnqueue(
                { kind: "check", mark_id: req.mark_id, result: req.result, comment: req.comment, photos: toQueuedPhotos(photos) },
                (key) => ChecksService.addCheck(req, photos, key),
            )
                .then((res) => {
                    notificationsStore.clear();
                    if (res.queued) {
                        notificationsStore.showError(null, t("offline.checkQueued"));
                    } else {
                        marksStore.fetch();
                        adminBoundariesStore.fetchMarksCount();
                        tasksStore.fetch();
                    }
                    navigate(`/problem/${mark.mark_id}`)
                })
                .catch((error) => {
                    console.error(error);
                    notificationsStore.showError(error, t("check.failed"));
                })
                .finally(() => setPending(false))
        }
    }

    const handleOnClickCancle = () => {
        navigate(`/problem/${mark.mark_id}`)
    }

    return (
        <>
            {user.id === 0 ?
                <UnauthorizedBlock
                    text={t("unauth.addCheck")}
                />
                :
                <>
                    <h2 className="section-title">{t("check.title")}</h2>

                    <p><b>{t("common.photos")}</b></p>
                    <SelectFiles files={photos} onChange={onSelectedFile} />

                    <p><b>{t("common.comment")}</b></p>
                    <textarea
                        className="edit-multiline-text"
                        name="comment"
                        value={comment}
                        maxLength={256}
                        onChange={(e) => { setComment(e.target.value) }}
                    ></textarea>
                    <div style={{ display: "flex", gap: "16px" }}>
                        <Button
                            style="negative"
                            onClick={() => addCheck(false)}
                            disabled={!checkValidate() || pending}
                        >
                            <p>{t("check.refute")}</p>
                        </Button>
                        <Button
                            style="positive"
                            onClick={() => addCheck(true)}
                            disabled={!checkValidate() || pending}
                        >
                            <p>{t("check.confirm")}</p>
                        </Button>
                    </div>
                    <div>

                        <Button
                            style="secondary"
                            onClick={handleOnClickCancle}
                        >
                            <p>{t("common.cancel")}</p>
                        </Button>
                    </div>
                </>
            }
        </>
    )
});

export default AddCheck;