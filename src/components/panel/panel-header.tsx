import { ReactNode, useEffect, useRef } from "react";
import panelStore from "../../store/panel";

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
 */
export default function PanelHeader({ title, subtitle, count, actions, openOnMount = false }: {
    title: ReactNode;
    subtitle?: ReactNode;
    count?: number;
    actions?: ReactNode;
    /** Panels reached from the header nav open the sheet as they mount. */
    openOnMount?: boolean;
}) {
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
        <div ref={ref} className="panel__header" onClick={() => panelStore.toggle()}>
            <div className="panel__header__row">
                <h1 className="panel__header__title">{title}</h1>
                {count !== undefined && count > 0 && <span className="panel__header__count">{count}</span>}
            </div>
            {subtitle !== undefined && subtitle !== "" && <p className="panel__header__sub">{subtitle}</p>}
            {actions && <div className="panel__header__acts" onClick={(e) => e.stopPropagation()}>{actions}</div>}
        </div>
    );
}
