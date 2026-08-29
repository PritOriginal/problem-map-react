import { useEffect, useRef, useState } from "react";
import { useT } from "../../../i18n";
import { Button } from "../../button/button";
import AuthService, { SignUpRequest } from "../../../services/AuthService";
import { signIn } from "../../../services/session";
import notificationsStore from "../../../store/notifications";
import { Link, useNavigate } from "react-router-dom";
import panelStore from "../../../store/panel";

export default function SignUp() {
    const { t } = useT();
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight)
            panelStore.setOpen(true);
        }
    }, []);

    const [username, setUsername] = useState("")
    const [login, setLogin] = useState("")
    const [password, setPassword] = useState("")

    const navigate = useNavigate();

    const onClick = () => {
        const req: SignUpRequest = {
            username: username,
            login: login,
            password: password
        }

        AuthService.signUp(req)
            .then(() => signIn(login, password))
            .then(() => navigate(-1))
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("auth.signUpError"));
            });
    }

    return (
        <>
            <div
                ref={panelHeaderRef}
                className="panel__header"
                onClick={() => panelStore.toggle()}
            >
                <p><b>{t("auth.signUpTitle")}</b></p>
            </div>
            <div className="panel__content">
                <p><b>{t("auth.name")}</b></p>
                <input
                    id="sku_edit"
                    className="edit-multiline-text"
                    name="sku"
                    value={username}
                    placeholder={t("auth.name")}
                    onChange={(e) => {
                        setUsername(e.target.value)
                    }}
                />
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
                <div>
                    <p><b>{t("auth.password")}</b></p>
                    <p style={{ fontSize: "12px" }}>{t("auth.passwordHint")}</p>
                </div>
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
                        <p>{t("nav.signUp")}</p>
                    </Button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <p>{t("auth.haveAccount")}</p>
                    <Link to={"/signin"}>
                        {t("nav.signIn")}
                    </Link>
                </div>
            </div>
        </>
    )
}