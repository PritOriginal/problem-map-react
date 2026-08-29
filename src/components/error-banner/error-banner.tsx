import { observer } from "mobx-react-lite";
import { useT } from "../../i18n";
import notificationsStore from "../../store/notifications";
import "./error-banner.scss";

const ErrorBanner = observer(() => {
    const { t } = useT();
    if (!notificationsStore.error) {
        return null;
    }
    return (
        <div className="error-banner" role="alert">
            <p className="error-banner__text">{notificationsStore.error}</p>
            <button
                type="button"
                className="error-banner__close"
                aria-label={t("common.close")}
                onClick={notificationsStore.clear}
            >
                ×
            </button>
        </div>
    );
});

export default ErrorBanner;
