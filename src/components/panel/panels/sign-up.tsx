import { useEffect, useRef, useState } from "react";
import { Button } from "../../button/button";
import AuthService, { SignInRequest, SignUpRequest } from "../../../services/AuthService";
import { jwtDecode } from "jwt-decode";
import user from "../../../store/user";
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
            .then((data) => {
                console.log(data.payload)
                signIn();
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    const signIn = () => {
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