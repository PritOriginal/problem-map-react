import { useMemo, useState } from "react";
import { TranslationKey, useT } from "../../../i18n";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";
import user from "../../../store/user";
import UsersService, { LEADERBOARD_PERIODS, LeaderboardEntry, LeaderboardPeriod } from "../../../services/UsersService";
import { usePagedData } from "../../../utils/use-paged-data";
import { useToKeepSearch } from "../../../utils/navigation";
import PanelHeader from "../panel-header";
import { AsyncState } from "../async-state";
import { ShowMore } from "../show-more";
import { BoundarySelect, PanelControls, SelectField } from "../panel-controls";

/** One page of the board; `meta.total` says whether the reader is seeing all of it. */
export const LEADERBOARD_LIMIT = 50;

const PERIOD_LABELS: Record<LeaderboardPeriod, TranslationKey> = {
    all: "leaderboard.period.all",
    month: "leaderboard.period.month",
    week: "leaderboard.period.week",
};

/** `/leaderboard`: top users, filtered by district (admin boundary) and period (backend integration/wave-5). */
const Leaderboard = observer(function Leaderboard() {
    const { t } = useT();
    const toKeepSearch = useToKeepSearch();

    const [boundaryId, setBoundaryId] = useState(0);
    const [period, setPeriod] = useState<LeaderboardPeriod>("all");
    const { items, isLoading, isLoadingMore, remaining, loadMore } = usePagedData<LeaderboardEntry>(
        (offset, signal) => UsersService
            .getLeaderboard({ boundary_id: boundaryId || undefined, period, limit: LEADERBOARD_LIMIT, offset }, { signal })
            .then((res) => ({ items: res.payload, meta: res.meta })),
        [boundaryId, period],
        { errorMessage: t("leaderboard.loadFailed") },
    );
    const entries: LeaderboardEntry[] = items;

    const periodOptions = useMemo(
        () => LEADERBOARD_PERIODS.map((p) => ({ value: p, label: t(PERIOD_LABELS[p]) })),
        [t],
    );

    return (
        <>
            <PanelHeader openOnMount title={t("leaderboard.title")} subtitle={t("leaderboard.top", { n: entries.length })} />
            <div className="panel__content">
                <PanelControls>
                    <BoundarySelect label={t("leaderboard.district")} value={boundaryId} onChange={setBoundaryId} />
                    <SelectField label={t("leaderboard.period")} value={period} options={periodOptions} onChange={setPeriod} />
                </PanelControls>
                {/* keepPrevious: a further page must not blank the rows already read */}
                <AsyncState keepPrevious isLoading={isLoading} isEmpty={entries.length === 0} empty={t("leaderboard.empty")}>
                    <ol className="leaderboard">
                        {entries.map((entry, index) => (
                            <li key={entry.user_id} className={`leaderboard__row${entry.user_id === user.id ? " leaderboard__row--me" : ""}`}>
                                <span className="leaderboard__place">{index + 1}</span>
                                <span className="leaderboard__avatar" aria-hidden="true">{entry.username.slice(0, 1)}</span>
                                <span className="leaderboard__who">
                                    <Link className="leaderboard__name" to={toKeepSearch(`/users/${entry.user_id}`)}>{entry.username}</Link>
                                    {entry.user_id === user.id && <i className="you-chip">{t("common.you")}</i>}
                                    {(entry.level !== undefined || entry.badges_count !== undefined) &&
                                        <span className="leaderboard__meta">
                                            {entry.level !== undefined && `${t("leaderboard.level")} ${entry.level}`}
                                            {entry.level !== undefined && entry.badges_count !== undefined && " · "}
                                            {entry.badges_count !== undefined && `${entry.badges_count} ${t("leaderboard.badges")}`}
                                        </span>
                                    }
                                </span>
                                <span className="leaderboard__rating">{entry.rating}</span>
                            </li>
                        ))}
                    </ol>
                </AsyncState>
                <ShowMore remaining={remaining} isLoading={isLoadingMore} onClick={loadMore} />
            </div>
        </>
    );
});

export default Leaderboard;
