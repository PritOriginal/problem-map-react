import { useEffect, useRef, useState } from "react";
import { Button } from "../../button/button";
import user from "../../../store/user";
import { signOut } from "../../../services/tokens";
import { Link, To } from "react-router-dom";
import panelStore from "../../../store/panel";
import notificationsStore from "../../../store/notifications";
import UsersService, { CurrentUser, UserStats } from "../../../services/UsersService";
import MarksService, { Mark } from "../../../services/MarksService";
import ChecksService, { Check } from "../../../services/ChecksService";
import { StatTile } from "../../stat-tile/stat-tile";
import markTypesStore from "../../../store/mark-types";
import { TypeMarkIcons } from "../../mark/mark";
import { MarkBadges } from "../../badges/badges";
import { TranslationKey, localeOf, useT } from "../../../i18n";
import organizationsStore from "../../../store/organizations";
import { observer } from "mobx-react-lite";
import UnauthorizedBlock from "../../unauthorized-block/unauthorized-block";
import { Role, parseRole } from "../../../utils/role";
import { useNavigateKeepSearch, useToKeepSearch } from "../../../utils/navigation";

const ROLE_NAMES: Record<Role, TranslationKey> = {
    user: "role.user",
    moderator: "role.moderator",
    admin: "role.admin",
    service: "role.service",
};

const Profile = observer(function Profile() {
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight)
            panelStore.setOpen(true);
        }
    }, []);

    const navigate = useNavigateKeepSearch();
    const toKeepSearch = useToKeepSearch();
    const { t } = useT();

    const [me, setMe] = useState<CurrentUser | null>(null);
    const [marks, setMarks] = useState<Mark[]>([]);
    const [checks, setChecks] = useState<Check[]>([]);
    const [stats, setStats] = useState<UserStats | null>(null);
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
            UsersService.getMyStats(),
        ]).then(([meRes, marksRes, checksRes, statsRes]) => {
            if (ignore) {
                return;
            }
            setIsLoading(false);
            if (meRes.status === "fulfilled") {
                const profile = meRes.value.payload.user;
                setMe(profile);
                user.setUser(profile.username, profile.user_id, parseRole(profile.role));
            } else {
                console.error(meRes.reason);
                notificationsStore.showError(meRes.reason, t("profile.loadFailed"));
            }
            if (marksRes.status === "fulfilled") {
                setMarks(marksRes.value.payload.marks ?? []);
            } else {
                console.error(marksRes.reason);
                notificationsStore.showError(marksRes.reason, t("profile.marksLoadFailed"));
            }
            if (checksRes.status === "fulfilled") {
                setChecks(checksRes.value.payload.checks ?? []);
            } else {
                console.error(checksRes.reason);
                notificationsStore.showError(checksRes.reason, t("profile.checksLoadFailed"));
            }
            if (statsRes.status === "fulfilled") {
                setStats(statsRes.value.payload);
            } else {
                // stats require backend integration/wave-3; keep the rest of the profile usable
                console.error(statsRes.reason);
                setStats(null);
            }
        });
        organizationsStore.fetch();
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                <p><b>{t("profile.title")}</b></p>
            </div>
            <div className="panel__content">
                {userId === 0 ?
                    <UnauthorizedBlock text={t("unauth.profile")} />
                    :
                    <>
                        <p><b>{t("profile.name")}:</b> {me?.username ?? user.username}</p>
                        <p><b>{t("profile.login")}:</b> {me?.login ?? "—"}</p>
                        <p><b>{t("profile.rating")}:</b> {me?.rating ?? "—"}</p>
                        <p><b>{t("profile.role")}:</b> {t(ROLE_NAMES[me?.role ?? user.role] ?? "role.user")}</p>
                        {me?.home_point &&
                            <p><b>{t("profile.homePoint")}:</b> {me.home_point.coordinates[1].toFixed(6)}, {me.home_point.coordinates[0].toFixed(6)}</p>
                        }
                        <hr />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                            <p style={{ fontSize: 18 }}><b>{t("profile.stats")}</b></p>
                            <Link to={toKeepSearch("/leaderboard")} style={{ fontSize: 14 }}>{t("profile.leaderboardLink")}</Link>
                        </div>
                        {stats ? <StatsBlock stats={stats} /> : !isLoading && <p style={{ fontSize: 14 }}>{t("profile.statsUnavailable")}</p>}
                        <hr />
                        <p style={{ fontSize: 18 }}><b>{t("profile.myMarks")}</b> {isLoading ? "" : `(${marks.length})`}</p>
                        {!isLoading && marks.length === 0 && <p style={{ fontSize: 14 }}>{t("profile.noMarks")}</p>}
                        <div className="profile-list">
                            {marks.map((mark) => <MarkRow key={mark.mark_id} mark={mark} to={toKeepSearch(`/problem/${mark.mark_id}`)} />)}
                        </div>
                        <hr />
                        <p style={{ fontSize: 18 }}><b>{t("profile.myChecks")}</b> {isLoading ? "" : `(${checks.length})`}</p>
                        {!isLoading && checks.length === 0 && <p style={{ fontSize: 14 }}>{t("profile.noChecks")}</p>}
                        <div className="profile-list">
                            {checks.map((check) => <CheckRow key={check.check_id} check={check} to={toKeepSearch(`/problem/${check.mark_id}`)} />)}
                        </div>
                        <hr />
                        <div>
                            <Button style="white-2-black" onClick={onClickSignOut}>
                                <p>{t("auth.signOut")}</p>
                            </Button>
                        </div>
                    </>
                }
            </div>
        </>
    )
});

function StatsBlock({ stats }: { stats: UserStats }) {
    const { t } = useT();
    const items: { value: number | string; label: string }[] = [
        { value: stats.rating, label: t("profile.stat.rating") },
        { value: stats.tasks_completed, label: t("profile.stat.tasks") },
        { value: stats.marks_total, label: t("profile.stat.marks") },
        { value: `${stats.marks_confirmed} / ${stats.marks_refuted}`, label: t("profile.stat.confirmedRefuted") },
        { value: stats.checks_total, label: t("profile.stat.checks") },
        { value: stats.checks_correct, label: t("profile.stat.correctChecks") },
    ];
    return (
        <div className="stat-grid">
            {items.map((item) => <StatTile key={item.label} value={item.value} label={item.label} />)}
        </div>
    );
}

const MarkRow = observer(function MarkRow({ mark, to }: { mark: Mark, to: To }) {
    const { t, lang } = useT();
    const type = markTypesStore.types.find((t) => t.mark_type_id === mark.mark_type_id);
    const Icon = TypeMarkIcons[mark.mark_type_id];
    return (
        <Link className="profile-list__item" to={to}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {Icon && Icon({ color: "#000" })}
                <p style={{ fontSize: 14 }}><b>{t("mark.n", { id: mark.mark_id })}</b> {type?.name ?? ""}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <MarkBadges mark={mark} />
                <p style={{ fontSize: 12 }}>{new Date(mark.created_at).toLocaleDateString(localeOf(lang))}</p>
            </div>
        </Link>
    );
});

function CheckRow({ check, to }: { check: Check, to: To }) {
    const { t, lang } = useT();
    return (
        <Link className="profile-list__item" to={to}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <p style={{ fontSize: 14 }}><b>{t("common.problemN", { id: check.mark_id })}</b></p>
                <p style={{ fontSize: 12 }}>{new Date(check.created_at).toLocaleDateString(localeOf(lang))}</p>
            </div>
            {check.result
                ? <p style={{ fontSize: 12, color: "green" }}>{t("mark.confirmedBy")}</p>
                : <p style={{ fontSize: 12, color: "red" }}>{t("mark.refutedBy")}</p>
            }
            {check.comment !== "" && <p style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{check.comment}</p>}
        </Link>
    );
}

export default Profile;
