import { useT } from "../../i18n";
import { useNavigateKeepSearch } from "../../utils/navigation";
import panelStore from "../../store/panel";

import AddIcon from "../../assets/plus.svg?react";
import LocateIcon from "../../assets/locate.svg?react";

/** Mobile only: reopens the panel the "place a mark" screen slid out of the way. */
export function OpenPanelButton() {
    const { t } = useT();
    return (
        <button type="button" className="center-button" aria-label={t("map.addMark")} onClick={() => panelStore.setOpen(true)}>
            {t("map.add")}
        </button>
    );
}

export function LocateButton({ onClick }: { onClick: () => void }) {
    const { t } = useT();
    return (
        <button type="button" className="circle-button locate-button" title={t("map.locate")} aria-label={t("map.locateAria")} onClick={onClick}>
            <span className="circle-button__content">
                <LocateIcon />
            </span>
        </button>
    );
}

export function AddMarkButton() {
    const navigate = useNavigateKeepSearch();
    const { t } = useT();

    return (
        <button type="button" className="circle-button add-mark-button" title={t("map.addMark")} aria-label={t("map.addMark")} onClick={() => navigate("/add")}>
            <span className="circle-button__content">
                <AddIcon />
            </span>
        </button>
    );
}
