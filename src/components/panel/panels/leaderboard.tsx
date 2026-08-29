import { useEffect, useRef, useState } from "react";
import { useT } from "../../../i18n";
import { observer } from "mobx-react-lite";
import panelStore from "../../../store/panel";
import user from "../../../store/user";
import notificationsStore from "../../../store/notifications";
import UsersService, { LeaderboardEntry } from "../../../services/UsersService";

export const LEADERBOARD_LIMIT = 50;

const Leaderboard = observer(function Leaderboard() {
    const { t } = useT();
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight);
            panelStore.setOpen(true);
        }
    }, []);

    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let ignore = false;
        setIsLoading(true);
        UsersService.getLeaderboard(LEADERBOARD_LIMIT, 0)
            .then((data) => {
                if (!ignore) {
                    setEntries(data.payload ?? []);
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
    }, []);

    return (
        <>
            <div ref={panelHeaderRef} className="panel__header" onClick={() => panelStore.toggle()}>
                <p><b>{t("leaderboard.title")}</b></p>
                <p style={{ fontSize: 12 }}>{t("leaderboard.top", { n: LEADERBOARD_LIMIT })}</p>
            </div>
            <div className="panel__content">
                {isLoading && <p style={{ fontSize: 14 }}>{t("common.loading")}</p>}
                {!isLoading && entries.length === 0 && <p style={{ fontSize: 14 }}>{t("leaderboard.empty")}</p>}
                <table className="leaderboard">
                    <tbody>
                        {entries.map((entry, index) => (
                            <tr key={entry.user_id} className={entry.user_id === user.id ? "me" : ""}>
                                <td className="leaderboard__place">{index + 1}</td>
                                <td>{entry.username}{entry.user_id === user.id && ` ${t("common.you")}`}</td>
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
