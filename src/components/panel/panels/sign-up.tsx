import { useId, useState } from "react";
import { useT } from "../../../i18n";
import AuthService, { SignUpRequest } from "../../../services/AuthService";
import { signIn } from "../../../services/session";
import notificationsStore from "../../../store/notifications";
import { Link, useNavigate } from "react-router-dom";
import selectedPoint, { HOME_ZONE_RADIUS_KM } from "../../../store/selected_point";
import { observer } from "mobx-react-lite";
import PanelHeader from "../panel-header";
import "./auth.scss";

const SignUp = observer(function SignUp() {
    const { t } = useT();
    const id = useId();

    const [username, setUsername] = useState("")
    const [login, setLogin] = useState("")
    const [password, setPassword] = useState("")

    const navigate = useNavigate();

    const onClick = () => {
        const req: SignUpRequest = {
            username: username,
            login: login,
            password: password,
            home_point: {
                type: "Point",
                coordinates: [selectedPoint.coords[0], selectedPoint.coords[1]],
            },
        }

        AuthService.signUp(req)
            .then(() => signIn(login, password))
            .then(() => navigate(-1))
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("auth.signUpError"));
            });
    }

    return (
        <>
            <PanelHeader openOnMount title={t("auth.signUpTitle")} subtitle={t("auth.signUpWhy")} />
            <div className="panel__content">
                {/* A real form: Enter submits, and every field carries an id of its
                    own. All three used to be id="sku_edit" name="sku", which breaks
                    the label-to-field link, breaks autofill, and tells a password
                    manager nothing about what it is filling. */}
                <form className="auth-form" onSubmit={(e) => { e.preventDefault(); onClick(); }}>
                    <div className="auth-form__field">
                        <label className="auth-form__label" htmlFor={`${id}-name`}>{t("auth.name")}</label>
                        <input
                            id={`${id}-name`}
                            className="edit-multiline-text"
                            name="nickname"
                            autoComplete="nickname"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="auth-form__field">
                        <label className="auth-form__label" htmlFor={`${id}-login`}>{t("auth.login")}</label>
                        <input
                            id={`${id}-login`}
                            className="edit-multiline-text"
                            name="username"
                            autoComplete="username"
                            value={login}
                            placeholder={t("auth.loginPlaceholder")}
                            onChange={(e) => setLogin(e.target.value)}
                        />
                    </div>
                    <div className="auth-form__field">
                        <label className="auth-form__label" htmlFor={`${id}-password`}>{t("auth.password")}</label>
                        <p className="auth-form__hint">{t("auth.passwordHint")}</p>
                        <input
                            id={`${id}-password`}
                            className="edit-multiline-text"
                            name="new-password"
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="auth-form__field">
                        <span className="auth-form__label">{t("profile.homePoint")}</span>
                        <p className="auth-form__hint">{t("auth.homePointHint", { radius: Math.round(HOME_ZONE_RADIUS_KM * 1000) })}</p>
                        <p className="auth-form__coords">
                            <span className="visually-hidden">{t("auth.coords")}: </span>
                            {selectedPoint.coords[1].toFixed(6)}, {selectedPoint.coords[0].toFixed(6)}
                        </p>
                    </div>
                    <button type="submit" className="auth-form__submit">{t("nav.createAccount")}</button>
                    <p className="auth-form__or">{t("auth.or")}</p>
                    <Link className="auth-form__alt" to={"/signin"}>{t("nav.signIn")}</Link>
                </form>
            </div>
        </>
    )
});

export default SignUp;
