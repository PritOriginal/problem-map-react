import { useNavigate } from "react-router-dom";
import { useT } from "../../i18n";
import { Button } from "../button/button";
import "./unauthorized-block.scss";

const UnauthorizedBlock = ({ text }: { text: string }) => {
    const navigate = useNavigate();
    const { t } = useT();

    return (
        <div className="unauthorized-block">
            <p><b>{t("unauth.title")}</b></p>
            <p>{text}</p>
            <div className="unauthorized-block__buttons">
                <Button
                    style="white-2-black"
                    onClick={() => navigate("/signin")}
                >
                    <p>{t("nav.signIn")}</p>
                </Button>
                <Button
                    style="black-2-white"
                    onClick={() => navigate("/signup")}
                >
                    <p>{t("nav.signUp")}</p>
                </Button>
            </div>
        </div>
    )
}

export default UnauthorizedBlock;