import { useId, useState } from "react";
import { useT } from "../../../i18n";
import { signIn } from "../../../services/session";
import notificationsStore from "../../../store/notifications";
import { Link, useNavigate } from "react-router-dom";
import PanelHeader from "../panel-header";
import "./auth.scss";

export default function SignIn() {
    const { t } = useT();
    const id = useId();

    const [login, setLogin] = useState("")
    const [password, setPassword] = useState("")

    const navigate = useNavigate();

    const onClick = () => {
        signIn(login, password)
            .then(() => navigate(-1))
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("auth.signInError"));
            });
    }

    return (
        <>
            <PanelHeader openOnMount title={t("auth.signInTitle")} subtitle={t("auth.signInWhy")} />
            <div className="panel__content">
                {/* A real form: Enter submits, and the fields carry ids of their own.
                    Both used to be id="sku_edit" name="sku", which breaks the
                    label-to-field link, breaks autofill, and tells a password
                    manager nothing about what it is filling. */}
                <form className="auth-form" onSubmit={(e) => { e.preventDefault(); onClick(); }}>
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
                        <input
                            id={`${id}-password`}
                            className="edit-multiline-text"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="auth-form__submit">{t("nav.signIn")}</button>
                    <p className="auth-form__or">{t("auth.or")}</p>
                    <Link className="auth-form__alt" to={"/signup"}>{t("nav.createAccount")}</Link>
                </form>
            </div>
        </>
    )
}
