import { useEffect, useMemo, useState } from "react";
import { TranslationKey, useT } from "../../../i18n";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";
import user from "../../../store/user";
import notificationsStore from "../../../store/notifications";
import adminBoundariesStore from "../../../store/admin-boundaries";
import UsersService, { LEADERBOARD_PERIODS, LeaderboardEntry, LeaderboardPeriod } from "../../../services/UsersService";
import { useToKeepSearch } from "../../../utils/navigation";
import PanelHeader from "../panel-header";

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

    useEffect(() => {
        // the store loads once and shares an in-flight request, so this reuses the map's data
        adminBoundariesStore.fetchBoundaries();
    }, []);

    const [boundaryId, setBoundaryId] = useState(0);
    const [period, setPeriod] = useState<LeaderboardPeriod>("all");
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let ignore = false;
        setIsLoading(true);
        UsersService.getLeaderboard({ boundary_id: boundaryId || undefined, period, limit: LEADERBOARD_LIMIT, offset: 0 })
            .then((data) => {
                if (!ignore) {
                    setEntries(data.payload);
                }
            })
            .catch((error) => {
                if (ignore) {
                    return;
                }
                console.error(error);
                notificationsStore.showError(error, t("leaderboard.loadFailed"));
            })
            .finally(() => {
                if (!ignore) {
                    setIsLoading(false);
                }
            });
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boundaryId, period]);

    const rawBoundaries = adminBoundariesStore.boundaries;
    const boundaries = useMemo(
        () => [...rawBoundaries].sort((a, b) => a.admin_level - b.admin_level || a.name.localeCompare(b.name)),
        [rawBoundaries],
    );

    return (
        <>
            <PanelHeader openOnMount title={t("leaderboard.title")} subtitle={t("leaderboard.top", { n: LEADERBOARD_LIMIT })} />
            <div className="panel__content">
                <div className="analytics-controls">
                    <label>
                        {t("leaderboard.district")}
                        <select value={boundaryId} onChange={(e) => setBoundaryId(Number(e.target.value))}>
                            <option value={0}>{t("analytics.wholeCity")}</option>
                            {boundaries.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </label>
                    <label>
                        {t("leaderboard.period")}
                        <select value={period} onChange={(e) => setPeriod(e.target.value as LeaderboardPeriod)}>
                            {LEADERBOARD_PERIODS.map((p) => <option key={p} value={p}>{t(PERIOD_LABELS[p])}</option>)}
                        </select>
                    </label>
                </div>
                {isLoading && <p className="empty-state">{t("common.loading")}</p>}
                {!isLoading && entries.length === 0 && <p className="empty-state">{t("leaderboard.empty")}</p>}
                {entries.length > 0 &&
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
                }
            </div>
        </>
    );
});

export default Leaderboard;
