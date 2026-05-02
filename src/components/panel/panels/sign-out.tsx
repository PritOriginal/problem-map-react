import { useEffect, useRef } from "react";
import { Button } from "../../button/button";
import user from "../../../store/user";
import { useNavigate } from "react-router-dom";
import panelStore from "../../../store/panel";

export default function Profile() {
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight)
            panelStore.setOpen(true);
        }
    }, []);

    const navigate = useNavigate();

    const onClickSignOut = () => {
        user.resetUser();
        navigate(-1);
    }

    return (
        <>
            <div
                ref={panelHeaderRef}
                className="panel__header"
                onClick={() => panelStore.toggle()}
            >
                <p><b>Профиль</b></p>
            </div>
            <div className="panel__content">
                <p><b>Логин:</b> {user.username}</p>
                <div>
                    <Button style="white-2-black" onClick={onClickSignOut}>
                        <p>Выйти из аккаунта</p>
                    </Button>
                </div>
            </div>
        </>
    )
}