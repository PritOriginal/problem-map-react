import { Button } from "./components/button/button";
import user from "./store/user";
import { useNavigate } from "react-router-dom";

export default function SignOut() {
    const navigate = useNavigate();

    const handleCloseClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (e.target === e.currentTarget) {
            navigate("/");
        }
    }

    const onClickSignOut = () => {
        user.resetUser();
        navigate("/");
    }

    return (
        <div className="modal" onClick={handleCloseClick}>
            <div className="modal__content">
                <p><b>Логин:</b> {user.username}</p>
                <div>
                    <Button style="white-2-black" onClick={onClickSignOut}>
                        <p>Выйти из аккаунта</p>
                    </Button>
                </div>
            </div>
        </div>
    )
}