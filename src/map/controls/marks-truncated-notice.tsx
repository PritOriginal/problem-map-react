import { observer } from "mobx-react-lite";

import { useT } from "../../i18n";
import marksStore from "../../store/marks";
import "./marks-truncated-notice.scss";

/**
 * Says so when the backend holds more marks for the current filters than the map was given.
 * Without it the cap is invisible: the map simply draws a page of marks and the rest do not
 * exist as far as the user can tell. `role="status"` so it is announced without stealing
 * focus -- it is a note about the view, not a failure, hence not the error banner.
 */
const MarksTruncatedNotice = observer(() => {
    const { t } = useT();
    if (!marksStore.truncated) {
        return null;
    }
    return (
        <p className="marks-truncated" role="status">
            {t("map.marksTruncated", { shown: marksStore.marks.length, total: marksStore.total })}
        </p>
    );
});

export default MarksTruncatedNotice;
