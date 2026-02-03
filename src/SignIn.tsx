import { useState } from "react";
import { Button } from "./components/button/button";
import AuthService, { SignInRequest } from "./services/AuthService";
import { jwtDecode } from "jwt-decode";
import user from "./store/user";
import { Link, useNavigate } from "react-router-dom";

export default function SignIn() {
    const [login, setLogin] = useState("")
    const [password, setPassword] = useState("")

    const navigate = useNavigate();

    const handleCloseClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (e.target === e.currentTarget) {
            navigate("/");
        }
    }

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
                    <p>Вход в аккаунт</p>
                </div>
                <div className="modal__container__content">
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
            </div>
        </div>
    )
}