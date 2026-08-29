import { useEffect, useRef, useState } from "react";
import { useT } from "../../../i18n";
import { Button } from "../../button/button";
import { signIn } from "../../../services/session";
import notificationsStore from "../../../store/notifications";
import { Link, useNavigate } from "react-router-dom";
import panelStore from "../../../store/panel";

export default function SignIn() {
    const { t } = useT();
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight)
            panelStore.setOpen(true);
        }
    }, []);

    const [login, setLogin] = useState("")
    const [password, setPassword] = useState("")

    const navigate = useNavigate();

    const onClick = () => {
        signIn(login, password)
            .then(() => navigate(-1))
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("auth.signInError"));
            });
    }

    return (
        <>
            <div
                ref={panelHeaderRef}
                className="panel__header"
                onClick={() => panelStore.toggle()}
            >
                <p><b>{t("auth.signInTitle")}</b></p>
            </div>
            <div className="panel__content">
                <p><b>{t("auth.login")}</b></p>
                <input
                    id="sku_edit"
                    className="edit-multiline-text"
                    name="sku"
                    value={login}
                    placeholder="login"
                    onChange={(e) => {
                        setLogin(e.target.value)
                    }}
                />
                <p><b>{t("auth.password")}</b></p>
                <input
                    id="sku_edit"
                    className="edit-multiline-text"
                    name="sku"
                    type="password"
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value)
                    }}
                />
                <div>
                    <Button style="white-2-black" onClick={onClick}>
                        <p>{t("nav.signIn")}</p>
                    </Button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <p>{t("auth.noAccount")}</p>
                    <Link to={"/signup"}>
                        {t("nav.signUp")}
                    </Link>
                </div>
            </div>
        </>
    )
}