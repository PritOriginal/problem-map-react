import { useContext, useMemo } from "react";
import { observer } from "mobx-react-lite";
import MarksService, { MarkStatusHistoryItem, MarkStatusType } from "../../../../services/MarksService";
import { useT } from "../../../../i18n";
import { useNavigateKeepSearch } from "../../../../utils/navigation";
import { layerDepths, layerSpans } from "../../../../utils/history-column";
import { useNow } from "../../../../utils/hooks";
import { useAsyncData } from "../../../../utils/use-async-data";
import markStatusesStore from "../../../../store/mark-statuses";
import user from "../../../../store/user";
import { Button } from "../../../button/button";
import { DuplicateBadge, HiddenBadge } from "../../../badges/badges";
import { MarkContext, MarkReloadContext } from "./mark-context";
import CommentsBlock from "./comments";
import { MarkActions } from "./blocks/mark-actions";
import { ModerationBlock } from "./blocks/moderation-block";
import { AssignBlock } from "./blocks/assign-block";
import { OwnerBlock } from "./blocks/owner-block";
import { HistoryGroup } from "./history/history-column";
import { canAddCheck, groupHistory } from "./history/use-history-groups";

const AboutProblem = observer(function AboutProblem() {
    const navigate = useNavigateKeepSearch();
    const { t } = useT();

    const mark = useContext(MarkContext)
    const reload = useContext(MarkReloadContext)
    const { data: historyItems = [] } = useAsyncData<MarkStatusHistoryItem[]>(
        (signal) => MarksService.getMarkStatusHistoryByMarkId(mark.mark_id, true, { signal }).then((res) => res.payload.items),
        // Fields, not the object: MarkContext hands down a freshly parsed `mark` on every
        // load of the panel above, so depending on its identity re-read the history even
        // when nothing about the mark had changed -- which is most of the time, since the
        // panel re-reads the mark after any action. The two fields kept are the ones the
        // history actually follows: a status change, and anything else the backend stamps
        // into `updated_at` (a check, for instance).
        [mark.mark_id, mark.mark_status_id, mark.updated_at],
        { enabled: mark.mark_id !== 0, errorMessage: t("mark.historyLoadFailed") },
    );

    // Memoized against the data they read, not against the render: `useNow` ticks this
    // component every 30 seconds to keep the running layer honest, and without the memo
    // every tick would regroup the whole history and re-decide the check button.
    // Read out of the stores here rather than inside the callbacks: an observable read
    // from within a `useMemo` body is not a dependency the memo can be keyed on.
    const statuses = markStatusesStore.statuses;
    const userId = user.id;
    const groups = useMemo(() => groupHistory(historyItems, statuses), [historyItems, statuses]);
    const possibilityAddCheck = useMemo(() => canAddCheck(mark, groups, userId), [mark, groups, userId]);

    // The column's geometry: how long the mark sat in each status, and how deep to
    // draw that stratum. `useNow` keeps the last (still-running) layer honest.
    const now = useNow();
    const spans = layerSpans(groups.map((group) => group[0].changed_at), now);
    const depths = layerDepths(spans);

    const handleOnClickNewCheck = () => {
        navigate(`/problem/${mark.mark_id}/add-check`)
    }

    return (
        <>
            <MarkActions onDone={reload} />
            {(mark.hidden || mark.merged_into_id) &&
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                    <HiddenBadge hidden={mark.hidden} />
                    <DuplicateBadge mergedIntoId={mark.merged_into_id} />
                </div>
            }
            {user.isModerator && mark.mark_id !== 0 && <ModerationBlock onDone={reload} />}
            {user.isModerator && mark.mark_id !== 0 && <AssignBlock onDone={reload} />}
            {user.id !== 0 && user.id === mark.user_id && mark.mark_status_id === MarkStatusType.UnconfirmedStatus && <OwnerBlock onDone={reload} />}
            {mark.description !== "" &&
                <>
                    <h2 className="section-title">{t("common.description")}</h2>
                    <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{mark.description}</p>
                    <hr />
                </>
            }
            <h2 className="section-title">{t("mark.history")}</h2>
            <hr />
            <ol className="core">
                {groups.map((group, index) => (
                    <HistoryGroup
                        key={index}
                        group={group}
                        depth={depths[index]}
                        spanMs={spans[index]}
                        isLast={index === groups.length - 1}
                    />
                ))}
            </ol>
            {mark.mark_id !== 0 && <CommentsBlock />}
            {possibilityAddCheck &&
                <div style={{ position: "sticky", bottom: "0" }}>
                    <Button style="primary" onClick={handleOnClickNewCheck}>
                        {t("mark.checkButton")}
                    </Button>
                </div>
            }
        </>
    );
});

export default AboutProblem;
