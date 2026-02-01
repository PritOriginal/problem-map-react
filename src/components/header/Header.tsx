import { Link } from "react-router-dom";
import "./Header.scss"
import user from "../../store/user";
import { observer } from "mobx-react-lite";

const Header = observer(function Header() {
    return (
        <header>
            <div className="header-container">
                <div style={{ display: "flex", gap: "32px" }}>
                    <p>Карта проблем</p>
                    <p style={{ color: "#bdbdbdff" }}>Задания</p>
                    <p style={{ color: "#bdbdbdff" }}>Рейтинг</p>
                </div>
                <div className="header-container__user-info">
                    {user.id !== 0 ?
                        <Link to={"/signout"}>
                            <p>{user.username}</p>
                        </Link>
                        :
                        <>
                            <Link to={"/signin"}>
                                <p>Войти</p>
                            </Link>
                            <Link to={"/signup"}>
                                <p>Зарегистрироваться</p>
                            </Link>
                        </>
                    }
                </div>
            </div>
        </header>
    );
});

export default Header;