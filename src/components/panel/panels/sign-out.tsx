import { useEffect } from "react";
import { Button } from "../../button/button";
import user from "../../../store/user";
import { signOut } from "../../../services/tokens";
import { Link, To } from "react-router-dom";
import UsersService from "../../../services/UsersService";
import { ProfileBody } from "../../profile/profile-screen";
import { useAsyncData } from "../../../utils/use-async-data";
import MarksService from "../../../services/MarksService";
import ChecksService, { Check } from "../../../services/ChecksService";
import { MarkRow } from "../../mark/mark-row";
import { TranslationKey, localeOf, useT } from "../../../i18n";
import organizationsStore from "../../../store/organizations";
import { observer } from "mobx-react-lite";
import UnauthorizedBlock from "../../unauthorized-block/unauthorized-block";
import { Role, parseRole } from "../../../utils/role";
import { useNavigateKeepSearch, useToKeepSearch } from "../../../utils/navigation";
import PanelHeader from "../panel-header";
import { AsyncState } from "../async-state";

const ROLE_NAMES: Record<Role, TranslationKey> = {
    user: "role.user",
    moderator: "role.moderator",
    admin: "role.admin",
    service: "role.service",
};

const Profile = observer(function Profile() {
    const navigate = useNavigateKeepSearch();
    const toKeepSearch = useToKeepSearch();
    const { t } = useT();

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
            <PanelHeader openOnMount title={t("profile.title")} />
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
                        <ProfileBody profile={profile} stats={stats} statsLoading={statsLoading} />
                        <hr />
                        <h2 className="section-title">{t("profile.myMarks")}<span className="section-title__count">{marksLoading ? "" : `(${marks.length})`}</span></h2>
                        <AsyncState keepPrevious isLoading={marksLoading} isEmpty={marks.length === 0} empty={t("profile.noMarks")}>
                            <div className="profile-list">
                                {marks.map((mark) => <MarkRow key={mark.mark_id} mark={mark} to={toKeepSearch(`/problem/${mark.mark_id}`)} />)}
                            </div>
                        </AsyncState>
                        <hr />
                        <h2 className="section-title">{t("profile.myChecks")}<span className="section-title__count">{checksLoading ? "" : `(${checks.length})`}</span></h2>
                        <AsyncState keepPrevious isLoading={checksLoading} isEmpty={checks.length === 0} empty={t("profile.noChecks")}>
                            <div className="profile-list">
                                {checks.map((check) => <CheckRow key={check.check_id} check={check} to={toKeepSearch(`/problem/${check.mark_id}`)} />)}
                            </div>
                        </AsyncState>
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
