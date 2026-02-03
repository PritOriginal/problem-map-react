import { useContext, useState } from "react";
import { Button } from "../../../button/button";
import { observer } from "mobx-react-lite";
import ChecksService, { AddCheckRequest } from "../../../../services/ChecksService";
import { MarkContext } from "./problem";
import { useNavigate } from "react-router-dom";
import SelectFiles from "../../../SelectFiles";
import user from "../../../../store/user";
import UnauthorizedBlock from "../../../unauthorized-block/unauthorized-block";

const AddCheck = observer(function AddProblem() {
    const navigate = useNavigate();

    const mark = useContext(MarkContext)

    const [comment, setComment] = useState("")
    const [photos, setPhotos] = useState<File[]>([]);

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

            ChecksService.addCheck(req, photos)
                .then((data) => {
                    console.log(data.payload);
                    navigate(`/problem/${mark.mark_id}`)
                })
                .catch((error) => {
                    console.log(error);
                })
        }
    }

    const handleOnClickCancle = () => {
        navigate(`/problem/${mark.mark_id}`)
    }

    return (
        <>
            {user.id === 0 ?
                <UnauthorizedBlock
                    text="Для того чтобы провести проверку, авторизуйтесь или создайте новый аккаунт"
                />
                :
                <>
                    <p style={{ fontSize: 18 }}><b>Провести проверку</b></p>

                    <p><b>Фотографии</b></p>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <SelectFiles onSelectedFiles={onSelectedFile} />
                    </div>

                    <p><b>Комментарий</b></p>
                    <textarea
                        className="edit-multiline-text"
                        name="comment"
                        value={comment}
                        maxLength={256}
                        onChange={(e) => { setComment(e.target.value) }}
                    ></textarea>
                    <div style={{ display: "flex", gap: "16px" }}>
                        <Button
                            style="red"
                            onClick={() => addCheck(false)}
                            disabled={!checkValidate()}
                        >
                            <p>Опровергнуть</p>
                        </Button>
                        <Button
                            style="green"
                            onClick={() => addCheck(true)}
                            disabled={!checkValidate()}
                        >
                            <p>Подтвердить</p>
                        </Button>
                    </div>
                    <div>

                        <Button
                            style="white-2-black"
                            onClick={handleOnClickCancle}
                        >
                            <p>Отмена</p>
                        </Button>
                    </div>
                </>
            }
        </>
    )
});

export default AddCheck;