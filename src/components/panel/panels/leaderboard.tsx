import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import panelStore from "../../../store/panel";
import user from "../../../store/user";
import notificationsStore from "../../../store/notifications";
import UsersService, { LeaderboardEntry } from "../../../services/UsersService";

export const LEADERBOARD_LIMIT = 50;

const Leaderboard = observer(function Leaderboard() {
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
                notificationsStore.showError(error, "Не удалось загрузить рейтинг");
            })
            .finally(() => {
                if (!ignore) {
                    setIsLoading(false);
                }
            });
        return () => {
            ignore = true;
        };
    }, []);

    return (
        <>
            <div ref={panelHeaderRef} className="panel__header" onClick={() => panelStore.toggle()}>
                <p><b>Рейтинг участников</b></p>
                <p style={{ fontSize: 12 }}>Топ-{LEADERBOARD_LIMIT} по рейтингу</p>
            </div>
            <div className="panel__content">
                {isLoading && <p style={{ fontSize: 14 }}>Загрузка…</p>}
                {!isLoading && entries.length === 0 && <p style={{ fontSize: 14 }}>Пока никого нет</p>}
                <table className="leaderboard">
                    <tbody>
                        {entries.map((entry, index) => (
                            <tr key={entry.user_id} className={entry.user_id === user.id ? "me" : ""}>
                                <td className="leaderboard__place">{index + 1}</td>
                                <td>{entry.username}{entry.user_id === user.id && " (вы)"}</td>
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
