import { ReactNode } from "react";
import { useT } from "../../i18n";
import "./show-more.scss";

/**
 * The foot of a paginated list.
 *
 * Four panels used to take a fixed first page (50 leaderboard rows, 100 queue marks,
 * 100 comments, 50 notifications) and silently drop the rest -- nothing on screen said
 * that what you were reading was not all of it. This is the control that says so, and
 * it is written the way the one precedent in the app is (`.checks__more` in the problem
 * card): it names the quantity left rather than showing a bare "more".
 *
 * Renders nothing when there is nothing left, so a call site can place it unconditionally.
 */
export function ShowMore({ remaining, isLoading, onClick }: {
    /** How many rows the backend still has (`meta.total` minus what is loaded). */
    remaining: number;
    /** A page is already on its way: the button says so and refuses a second click. */
    isLoading: boolean;
    onClick: () => void;
}): ReactNode {
    const { t } = useT();
    if (remaining <= 0) {
        return null;
    }
    return (
        <button type="button" className="show-more" disabled={isLoading} onClick={onClick}>
            {isLoading ? t("common.loading") : t("common.showMore", { n: remaining })}
        </button>
    );
}

export default ShowMore;
