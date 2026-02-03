import { useState } from "react";
import { Button } from "./components/button/button";
import AuthService, { SignInRequest, SignUpRequest } from "./services/AuthService";
import { jwtDecode } from "jwt-decode";
import user from "./store/user";
import { Link, useNavigate } from "react-router-dom";

export default function SignUp() {
    const [username, setUsername] = useState("")
    const [login, setLogin] = useState("")
    const [password, setPassword] = useState("")

    const navigate = useNavigate();

    const handleCloseClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (e.target === e.currentTarget) {
            navigate("/");
        }
    }

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
                navigate("/");
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    return (
        <div className="modal" onClick={handleCloseClick}>
            <div className="modal__container">
                <div className="modal__container__header">
                    <p>Регистрация</p>
                </div>
                <div className="modal__container__content">
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
            </div>
        </div>
    )
}