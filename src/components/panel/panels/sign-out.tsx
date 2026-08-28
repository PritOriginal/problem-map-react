import { useEffect, useRef, useState } from "react";
import { Button } from "../../button/button";
import user from "../../../store/user";
import { signOut } from "../../../services/tokens";
import { Link, useNavigate } from "react-router-dom";
import panelStore from "../../../store/panel";
import notificationsStore from "../../../store/notifications";
import UsersService, { CurrentUser } from "../../../services/UsersService";
import MarksService, { Mark } from "../../../services/MarksService";
import ChecksService, { Check } from "../../../services/ChecksService";
import markStatusesStore from "../../../store/mark-statuses";
import markTypesStore from "../../../store/mark-types";
import { COLOR_MARK_STATUSES, TypeMarkIcons } from "../../mark/mark";
import { observer } from "mobx-react-lite";
import UnauthorizedBlock from "../../unauthorized-block/unauthorized-block";
import { Role } from "../../../utils/role";

const ROLE_NAMES: Record<Role, string> = {
    user: "Пользователь",
    moderator: "Модератор",
    admin: "Администратор",
};

const Profile = observer(function Profile() {
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight)
            panelStore.setOpen(true);
        }
    }, []);

    const navigate = useNavigate();

    const [me, setMe] = useState<CurrentUser | null>(null);
    const [marks, setMarks] = useState<Mark[]>([]);
    const [checks, setChecks] = useState<Check[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const userId = user.id;

    useEffect(() => {
        if (userId === 0) {
            return;
        }
        let ignore = false;
        setIsLoading(true);
        Promise.allSettled([
            UsersService.getMe(),
            MarksService.getMarksByUserId(userId),
            ChecksService.getChecksByUserId(userId),
        ]).then(([meRes, marksRes, checksRes]) => {
            if (ignore) {
                return;
            }
            setIsLoading(false);
            if (meRes.status === "fulfilled") {
                const profile = meRes.value.payload.user;
                setMe(profile);
                user.setUser(profile.username, profile.user_id, profile.role);
            } else {
                console.error(meRes.reason);
                notificationsStore.showError(meRes.reason, "Не удалось загрузить профиль");
            }
            if (marksRes.status === "fulfilled") {
                setMarks(marksRes.value.payload.marks ?? []);
            } else {
                console.error(marksRes.reason);
                notificationsStore.showError(marksRes.reason, "Не удалось загрузить ваши метки");
            }
            if (checksRes.status === "fulfilled") {
                setChecks(checksRes.value.payload.checks ?? []);
            } else {
                console.error(checksRes.reason);
                notificationsStore.showError(checksRes.reason, "Не удалось загрузить ваши проверки");
            }
        });
        return () => {
            ignore = true;
        };
    }, [userId]);

    const onClickSignOut = () => {
        signOut();
        navigate("/");
    }

    return (
        <>
            <div
                ref={panelHeaderRef}
                className="panel__header"
                onClick={() => panelStore.toggle()}
            >
                <p><b>Профиль</b></p>
            </div>
            <div className="panel__content">
                {userId === 0 ?
                    <UnauthorizedBlock text="Чтобы посмотреть профиль, войдите в аккаунт" />
                    :
                    <>
                        <p><b>Имя:</b> {me?.username ?? user.username}</p>
                        <p><b>Логин:</b> {me?.login ?? "—"}</p>
                        <p><b>Рейтинг:</b> {me?.rating ?? "—"}</p>
                        <p><b>Роль:</b> {ROLE_NAMES[me?.role ?? user.role]}</p>
                        {me?.home_point && me.home_point.coordinates.length >= 2 &&
                            <p><b>Домашняя точка:</b> {me.home_point.coordinates[1].toFixed(6)}, {me.home_point.coordinates[0].toFixed(6)}</p>
                        }
                        <hr />
                        <p style={{ fontSize: 18 }}><b>Мои метки</b> {isLoading ? "" : `(${marks.length})`}</p>
                        {!isLoading && marks.length === 0 && <p style={{ fontSize: 14 }}>Вы ещё не отмечали проблем</p>}
                        <div className="profile-list">
                            {marks.map((mark) => <MarkRow key={mark.mark_id} mark={mark} />)}
                        </div>
                        <hr />
                        <p style={{ fontSize: 18 }}><b>Мои проверки</b> {isLoading ? "" : `(${checks.length})`}</p>
                        {!isLoading && checks.length === 0 && <p style={{ fontSize: 14 }}>Вы ещё не делали проверок</p>}
                        <div className="profile-list">
                            {checks.map((check) => <CheckRow key={check.check_id} check={check} />)}
                        </div>
                        <hr />
                        <div>
                            <Button style="white-2-black" onClick={onClickSignOut}>
                                <p>Выйти из аккаунта</p>
                            </Button>
                        </div>
                    </>
                }
            </div>
        </>
    )
});

const MarkRow = observer(function MarkRow({ mark }: { mark: Mark }) {
    const status = markStatusesStore.statuses.find((s) => s.mark_status_id === mark.mark_status_id);
    const type = markTypesStore.types.find((t) => t.mark_type_id === mark.mark_type_id);
    const Icon = TypeMarkIcons[mark.mark_type_id];
    return (
        <Link className="profile-list__item" to={`/problem/${mark.mark_id}`}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {Icon && Icon({ color: "#000" })}
                <p style={{ fontSize: 14 }}><b>№{mark.mark_id}</b> {type?.name ?? ""}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <span
                    className="profile-list__status"
                    style={{ borderColor: COLOR_MARK_STATUSES[mark.mark_status_id] ?? "#000" }}
                >
                    {status?.name ?? `Статус ${mark.mark_status_id}`}
                </span>
                <p style={{ fontSize: 12 }}>{new Date(mark.created_at).toLocaleDateString()}</p>
            </div>
        </Link>
    );
});

function CheckRow({ check }: { check: Check }) {
    return (
        <Link className="profile-list__item" to={`/problem/${check.mark_id}`}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <p style={{ fontSize: 14 }}><b>Проблема №{check.mark_id}</b></p>
                <p style={{ fontSize: 12 }}>{new Date(check.created_at).toLocaleDateString()}</p>
            </div>
            {check.result
                ? <p style={{ fontSize: 12, color: "green" }}>Подтвердил</p>
                : <p style={{ fontSize: 12, color: "red" }}>Опроверг</p>
            }
            {check.comment !== "" && <p style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{check.comment}</p>}
        </Link>
    );
}

export default Profile;
