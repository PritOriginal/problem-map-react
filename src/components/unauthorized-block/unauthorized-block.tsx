import { useNavigate } from "react-router-dom";
import { Button } from "../button/button";
import "./unauthorized-block.scss";

const UnauthorizedBlock = ({ text }: { text: string }) => {
    const navigate = useNavigate();

    return (
        <div className="unauthorized-block">
            <p><b>Вы не авторизаваны</b></p>
            <p>{text}</p>
            <div className="unauthorized-block__buttons">
                <Button
                    style="white-2-black"
                    onClick={() => navigate("/signin")}
                >
                    <p>Войти</p>
                </Button>
                <Button
                    style="black-2-white"
                    onClick={() => navigate("/signup")}
                >
                    <p>Зарегистрироваться</p>
                </Button>
            </div>
        </div>
    )
}

export default UnauthorizedBlock;