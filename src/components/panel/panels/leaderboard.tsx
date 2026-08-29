import { useEffect, useMemo, useRef, useState } from "react";
import { TranslationKey, useT } from "../../../i18n";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";
import panelStore from "../../../store/panel";
import user from "../../../store/user";
import notificationsStore from "../../../store/notifications";
import adminBoundariesStore from "../../../store/admin-boundaries";
import UsersService, { LEADERBOARD_PERIODS, LeaderboardEntry, LeaderboardPeriod } from "../../../services/UsersService";
import { useToKeepSearch } from "../../../utils/navigation";

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
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight);
            panelStore.setOpen(true);
        }
    }, []);

    useEffect(() => {
        if (adminBoundariesStore.boundaries.length === 0 && !adminBoundariesStore.isLoadingBoundaries) {
            adminBoundariesStore.fetchBoundaries();
        }
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
            <div ref={panelHeaderRef} className="panel__header" onClick={() => panelStore.toggle()}>
                <p><b>{t("leaderboard.title")}</b></p>
                <p style={{ fontSize: 12 }}>{t("leaderboard.top", { n: LEADERBOARD_LIMIT })}</p>
            </div>
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
                {isLoading && <p style={{ fontSize: 14 }}>{t("common.loading")}</p>}
                {!isLoading && entries.length === 0 && <p style={{ fontSize: 14 }}>{t("leaderboard.empty")}</p>}
                <table className="leaderboard">
                    <tbody>
                        {entries.map((entry, index) => (
                            <tr key={entry.user_id} className={entry.user_id === user.id ? "me" : ""}>
                                <td className="leaderboard__place">{index + 1}</td>
                                <td>
                                    <Link to={toKeepSearch(`/users/${entry.user_id}`)} style={{ color: "inherit" }}>{entry.username}</Link>
                                    {entry.user_id === user.id && ` ${t("common.you")}`}
                                    {(entry.level !== undefined || entry.badges_count !== undefined) &&
                                        <span style={{ fontSize: 11, color: "#555", marginLeft: 6 }}>
                                            {entry.level !== undefined && `${t("leaderboard.level")} ${entry.level}`}
                                            {entry.level !== undefined && entry.badges_count !== undefined && " · "}
                                            {entry.badges_count !== undefined && `${entry.badges_count} ${t("leaderboard.badges")}`}
                                        </span>
                                    }
                                </td>
                                <td className="leaderboard__rating">{entry.rating}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
});

export default Leaderboard;
