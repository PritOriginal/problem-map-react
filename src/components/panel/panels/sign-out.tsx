import { useEffect, useRef } from "react";
import { Button } from "../../button/button";
import user from "../../../store/user";
import { signOut } from "../../../services/tokens";
import { Link, To } from "react-router-dom";
import panelStore from "../../../store/panel";
import UsersService, { UserStats } from "../../../services/UsersService";
import { BadgesBlock, LevelBlock } from "../../profile/profile-blocks";
import { useBadgeCatalogue } from "../../../utils/badges";
import { useAsyncData } from "../../../utils/use-async-data";
import MarksService, { Mark } from "../../../services/MarksService";
import ChecksService, { Check } from "../../../services/ChecksService";
import { StatTile } from "../../stat-tile/stat-tile";
import markTypesStore from "../../../store/mark-types";
import { TypeIcon } from "../../mark/mark";
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

    const catalogue = useBadgeCatalogue();

    const userId = user.id;
    const enabled = userId !== 0;

    useEffect(() => {
        if (enabled) {
            organizationsStore.fetch();
        }
    }, [enabled]);

    // Five independent reads. `Promise.allSettled` was only ever a way to keep one
    // failing request from taking the others down with it, and five hooks do that on
    // their own -- each with its own loader, its own message, and its own cancellation.
    const { data: me = null } = useAsyncData(
        (signal) => UsersService.getMe({ signal }).then((res) => {
            const current = res.payload.user;
            user.setUser(current.username, current.user_id, parseRole(current.role));
            return current;
        }),
        [userId],
        { enabled, errorMessage: t("profile.loadFailed") },
    );

    const { data: marks = [], isLoading: marksLoading } = useAsyncData(
        (signal) => MarksService.getMarksByUserId(userId, { signal }).then((res) => res.payload.marks ?? []),
        [userId],
        { enabled, errorMessage: t("profile.marksLoadFailed") },
    );

    const { data: checks = [], isLoading: checksLoading } = useAsyncData(
        (signal) => ChecksService.getChecksByUserId(userId, { signal }).then((res) => res.payload.checks ?? []),
        [userId],
        { enabled, errorMessage: t("profile.checksLoadFailed") },
    );

    // stats require backend integration/wave-3, level/badges wave-5: a backend without
    // them leaves the rest of the profile usable and says nothing in the banner.
    const { data: stats = null, isLoading: statsLoading } = useAsyncData(
        (signal) => UsersService.getMyStats({ signal }).then((res) => res.payload),
        [userId],
        { enabled, silent: true },
    );

    const { data: profile = null } = useAsyncData(
        (signal) => UsersService.getMyProfile({ signal }).then((res) => res.payload),
        [userId],
        { enabled, silent: true },
    );

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
                        <Link to={toKeepSearch(`/users/${userId}`)} style={{ fontSize: 14 }}>{t("profile.openPublic")}</Link>
                        <hr />
                        {profile &&
                            <>
                                <LevelBlock rating={profile.rating} level={profile.level} />
                                <h2 className="section-title">{t("profile.badges")}<span className="section-title__count">({profile.badges.length})</span></h2>
                                <BadgesBlock badges={profile.badges} catalogue={catalogue} />
                                <hr />
                            </>
                        }
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                            <h2 className="section-title">{t("profile.stats")}</h2>
                            <Link to={toKeepSearch("/leaderboard")} style={{ fontSize: 14 }}>{t("profile.leaderboardLink")}</Link>
                        </div>
                        {stats ? <StatsBlock stats={stats} /> : !statsLoading && <p className="empty-state">{t("profile.statsUnavailable")}</p>}
                        <hr />
                        <h2 className="section-title">{t("profile.myMarks")}<span className="section-title__count">{marksLoading ? "" : `(${marks.length})`}</span></h2>
                        {!marksLoading && marks.length === 0 && <p className="empty-state">{t("profile.noMarks")}</p>}
                        <div className="profile-list">
                            {marks.map((mark) => <MarkRow key={mark.mark_id} mark={mark} to={toKeepSearch(`/problem/${mark.mark_id}`)} />)}
                        </div>
                        <hr />
                        <h2 className="section-title">{t("profile.myChecks")}<span className="section-title__count">{checksLoading ? "" : `(${checks.length})`}</span></h2>
                        {!checksLoading && checks.length === 0 && <p className="empty-state">{t("profile.noChecks")}</p>}
                        <div className="profile-list">
                            {checks.map((check) => <CheckRow key={check.check_id} check={check} to={toKeepSearch(`/problem/${check.mark_id}`)} />)}
                        </div>
                        <hr />
                        <div>
                            <Button style="secondary" onClick={onClickSignOut}>
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
    return (
        <Link className="profile-list__item" to={to}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <TypeIcon typeId={mark.mark_type_id} type={type} color="#000" />
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
                ? <p style={{ fontSize: 12, color: "var(--success-ink)" }}>{t("mark.confirmedBy")}</p>
                : <p style={{ fontSize: 12, color: "var(--danger-ink)" }}>{t("mark.refutedBy")}</p>
            }
            {check.comment !== "" && <p style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{check.comment}</p>}
        </Link>
    );
}

export default Profile;
