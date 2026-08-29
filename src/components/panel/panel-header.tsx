import { ReactNode, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import panelStore from "../../store/panel";
import { useT } from "../../i18n";

/**
 * The header every panel wears.
 *
 * Nine panels each wrote their own as `<p><b>title</b></p>` plus a subtitle
 * styled inline at 12px, and each repeated the same ref-and-measure effect that
 * feeds `--panel-header-height` (the mobile sheet's collapsed height). One
 * component so the measurement and the layout stay in step.
 *
 * `count` is the figure the screen is opened for -- how many reports are queued,
 * how many complaints are waiting -- which none of those headers carried.
 * `actions` are controls that belong to the whole screen; they sat as the first
 * row of the content before, where they scrolled away with it.
 *
 * Collapsing the sheet is a `<button>` -- the grab handle at the top edge of the
 * mobile sheet, which is where a person already reaches for it. It used to be an
 * `onClick` on the whole header `<div>`: no role, no keyboard, and it swallowed
 * the clicks meant for the buttons inside it, which is why `actions` needed an
 * `onClick={(e) => e.stopPropagation()}` wrapper. Both are gone.
 */
const PanelHeader = observer(function PanelHeader({ title, subtitle, count, actions, openOnMount = false }: {
    title: ReactNode;
    subtitle?: ReactNode;
    count?: number;
    actions?: ReactNode;
    /** Panels reached from the header nav open the sheet as they mount. */
    openOnMount?: boolean;
}) {
    const { t } = useT();
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (ref.current) {
            panelStore.setHeight(ref.current.offsetHeight);
            if (openOnMount) {
                panelStore.setOpen(true);
            }
        }
    }, [openOnMount]);

    return (
        <div ref={ref} className="panel__header">
            <button
                type="button"
                className="panel__header__handle"
                aria-expanded={panelStore.isOpen}
                aria-label={t(panelStore.isOpen ? "panel.collapse" : "panel.expand")}
                onClick={() => panelStore.toggle()}
            >
                <span className="panel__header__grip" aria-hidden="true" />
            </button>
            <div className="panel__header__row">
                <h1 className="panel__header__title">{title}</h1>
                {count !== undefined && count > 0 && <span className="panel__header__count">{count}</span>}
            </div>
            {subtitle !== undefined && subtitle !== "" && <p className="panel__header__sub">{subtitle}</p>}
            {actions && <div className="panel__header__acts">{actions}</div>}
        </div>
    );
});

export default PanelHeader;
