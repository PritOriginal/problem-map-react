import { useEffect, useRef, useState } from "react";
import { Button } from "../../button/button";
import AuthService, { SignUpRequest } from "../../../services/AuthService";
import { signIn } from "../../../services/session";
import notificationsStore from "../../../store/notifications";
import { Link, useNavigate } from "react-router-dom";
import panelStore from "../../../store/panel";

export default function SignUp() {
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
                notificationsStore.showError(error, "Не удалось зарегистрироваться");
            });
    }

    return (
        <>
            <div
                ref={panelHeaderRef}
                className="panel__header"
                onClick={() => panelStore.toggle()}
            >
                <p><b>Регистрация</b></p>
            </div>
            <div className="panel__content">
                <p><b>Имя</b></p>
                <input
                    id="sku_edit"
                    className="edit-multiline-text"
                    name="sku"
                    value={username}
                    placeholder="Имя"
                    onChange={(e) => {
                        setUsername(e.target.value)
                    }}
                />
                <p><b>Логин</b></p>
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
                    <p><b>Пароль</b></p>
                    <p style={{ fontSize: "12px" }}>Минимум 8 символов</p>
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
                        <p>Зарегистрироваться</p>
                    </Button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <p>Уже есть аккаунт?</p>
                    <Link to={"/signin"}>
                        Войти
                    </Link>
                </div>
            </div>
        </>
    )
}