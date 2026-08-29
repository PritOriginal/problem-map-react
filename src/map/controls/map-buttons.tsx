import type { KeyboardEvent } from "react";

import { useT } from "../../i18n";
import { useNavigateKeepSearch } from "../../utils/navigation";
import panelStore from "../../store/panel";

import AddIcon from "../../assets/plus.svg?react";
import LocateIcon from "../../assets/locate.svg?react";

/**
 * Props that make a clickable <div> behave like a button for keyboard and screen-reader
 * users. Shared with the filters button, which is the same round control.
 */
export function buttonProps(label: string, onClick: () => void) {
    return {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": label,
        onClick,
        onKeyDown: (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
            }
        },
    };
}

/** Mobile only: reopens the panel the "place a mark" screen slid out of the way. */
export function OpenPanelButton() {
    const { t } = useT();
    return (
        <div className="center-button" {...buttonProps(t("map.addMark"), () => panelStore.setOpen(true))}>
            {t("map.add")}
        </div>
    );
}

export function LocateButton({ onClick }: { onClick: () => void }) {
    const { t } = useT();
    return (
        <div className="circle-button locate-button" title={t("map.locate")} {...buttonProps(t("map.locateAria"), onClick)}>
            <div className="circle-button__content">
                <LocateIcon />
            </div>
        </div>
    );
}

export function AddMarkButton() {
    const navigate = useNavigateKeepSearch();
    const { t } = useT();

    return (
        <div className="circle-button add-mark-button" title={t("map.addMark")} {...buttonProps(t("map.addMark"), () => navigate("/add"))}>
            <div className="circle-button__content">
                <AddIcon />
            </div>
        </div>
    );
}
