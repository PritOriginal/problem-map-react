import { ReactNode } from "react";
import { useT } from "../../i18n";

/**
 * The loading line and the empty line of a list, in one place.
 *
 * Twelve panels each wrote the same pair by hand:
 *
 * ```tsx
 * {isLoading && <p className="empty-state">{t("common.loading")}</p>}
 * {!isLoading && items.length === 0 && <p className="empty-state">{t("x.empty")}</p>}
 * {items.length > 0 && <List />}
 * ```
 *
 * ...and they did not all write it the same way, which is the reason this is a
 * component rather than a snippet: half of them guarded the loading line with
 * `items.length === 0` as well, so that changing a filter re-rendered the list
 * that is already on screen instead of blanking it for the length of a request.
 * That is `keepPrevious`, and it is the only difference between the two shapes.
 */
export function AsyncState({ isLoading, isEmpty, empty, keepPrevious = false, children }: {
    isLoading: boolean;
    isEmpty: boolean;
    /** The line to show when the request came back with nothing. A bare string is
     *  wrapped in the shared `.empty-state` paragraph. */
    empty: ReactNode;
    /** Not to flash the loader over an already rendered list when a filter changes. */
    keepPrevious?: boolean;
    children: ReactNode;
}): ReactNode {
    const { t } = useT();
    const showLoading = isLoading && (!keepPrevious || isEmpty);
    return (
        <>
            {showLoading && <p className="empty-state">{t("common.loading")}</p>}
            {!isLoading && isEmpty && (typeof empty === "string" ? <p className="empty-state">{empty}</p> : empty)}
            {!isEmpty && children}
        </>
    );
}

export default AsyncState;
