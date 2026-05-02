import { useEffect, useRef, useState } from "react";
import { Button } from "../../button/button";
import AuthService, { SignInRequest } from "../../../services/AuthService";
import { jwtDecode } from "jwt-decode";
import user from "../../../store/user";
import { Link, useNavigate } from "react-router-dom";
import panelStore from "../../../store/panel";

export default function SignIn() {
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
        const req: SignInRequest = {
            login: login,
            password: password
        }

        AuthService.signIn(req)
            .then((data) => {
                console.log(data.payload)
                const payload = jwtDecode(data.payload.access_token)
                localStorage.setItem('access_token', data.payload.access_token);
                localStorage.setItem('refresh_token', data.payload.refresh_token);
                user.setUser(login, Number(payload.sub));
                navigate(-1);
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    return (
        <>
            <div
                ref={panelHeaderRef}
                className="panel__header"
                onClick={() => panelStore.toggle()}
            >
                <p><b>Вход в аккаунт</b></p>
            </div>
            <div className="panel__content">
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
                <p><b>Пароль</b></p>
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
                        <p>Войти</p>
                    </Button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <p>Нет аккаунта?</p>
                    <Link to={"/signup"}>
                        Зарегистрироваться
                    </Link>
                </div>
            </div>
        </>
    )
}