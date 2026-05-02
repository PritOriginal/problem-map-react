import { Link } from "react-router-dom";
import "./Header.scss"
import user from "../../store/user";
import { observer } from "mobx-react-lite";

import ProfileIcon from "../../assets/profile.svg?react"
import MapIcon from "../../assets/map.svg?react"
import { useDeviceDetect } from "../../utils/hooks";

const Header = observer(function Header() {
    const { isMobile } = useDeviceDetect();

    return (
        <header>
            <div className="header-container">
                <div className="header-container__menu">
                    <MapIcon style={{ fill: "white", width: "32px" }} />
                    <p style={{ color: "#bdbdbdff" }}>Задания</p>
                    <p style={{ color: "#bdbdbdff" }}>Рейтинг</p>
                </div>
                <div className="header-container__user-info">
                    {user.id !== 0 ?
                        <>
                            <Link className="header-container__user-info__item" to={"/profile"}>
                                <p>{user.username}</p>
                                <ProfileIcon style={{ fill: "white", stroke: "white", height: "32px" }} />
                            </Link>
                        </>
                        :
                        <>
                            {isMobile ?
                                <Link className="header-container__user-info__item" to={"/signin"}>
                                    <p>Войти</p>
                                    <ProfileIcon style={{ fill: "white", stroke: "white", height: "32px" }} />
                                </Link>
                                :
                                <>
                                    <Link className="header-container__user-info__item" to={"/signin"}>
                                        <p>Войти</p>
                                    </Link>
                                    <p>|</p>
                                    <Link to={"/signup"}>
                                        <p>Зарегистрироваться</p>
                                    </Link>
                                    <Link className="header-container__user-info__item" to={"/signin"}>
                                        <ProfileIcon style={{ fill: "white", stroke: "white", height: "32px" }} />
                                    </Link>
                                </>
                            }
                        </>
                    }
                </div>
            </div>
        </header>
    );
});

export default Header;