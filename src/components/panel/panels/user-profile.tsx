import { useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { Link, useParams } from "react-router-dom";
import panelStore from "../../../store/panel";
import user from "../../../store/user";
import UsersService from "../../../services/UsersService";
import { ApiError } from "../../../services/http";
import { BadgesBlock, LevelBlock, ProfileStats } from "../../profile/profile-blocks";
import { useBadgeCatalogue } from "../../../utils/badges";
import { useAsyncData } from "../../../utils/use-async-data";
import { localeOf, useT } from "../../../i18n";
import { useToKeepSearch } from "../../../utils/navigation";
import PanelHeader from "../panel-header";

/** `/users/:id`: public profile with level, badges and statistics (backend integration/wave-5). */
const UserProfilePanel = observer(function UserProfilePanel() {
    const { t, lang } = useT();
    const params = useParams();
    const toKeepSearch = useToKeepSearch();
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    const catalogue = useBadgeCatalogue();

    const id = Number(params.id);
    const { data, isLoading } = useAsyncData(
        (signal) => UsersService.getProfile(id, { signal })
            .then((res) => res.payload)
            // A 404 is "no such user", not a failure: it belongs in the panel's empty
            // state, and turning it into an absent profile here keeps it out of the
            // error banner the hook raises for everything else.
            .catch((error: unknown) => {
                if (error instanceof ApiError && error.status === 404) {
                    return null;
                }
                throw error;
            }),
        [id],
        { enabled: Number.isFinite(id) && id > 0, errorMessage: t("profile.publicLoadFailed") },
    );
    // While a new id is in flight the panel shows only its loader, as it did when the
    // effect blanked the profile before every request.
    const profile = isLoading ? null : data ?? null;
    const notFound = !isLoading && data === null;

    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight);
            panelStore.setOpen(true);
        }
    }, [profile]);

    const subtitle = profile
        ? `${t("profile.rating")}: ${profile.rating}${profile.member_since ? ` · ${t("profile.memberSince")} ${new Date(profile.member_since).toLocaleDateString(localeOf(lang))}` : ""}`
        : t("profile.public");

    return (
        <>
            <PanelHeader
                openOnMount
                title={<>{profile?.username ?? t("profile.public")}{profile && profile.user_id === user.id && <i className="you-chip you-chip--on-chrome">{t("common.youShort")}</i>}</>}
                subtitle={subtitle}
            />
            <div className="panel__content">
                {isLoading && <p className="empty-state">{t("common.loading")}</p>}
                {(notFound || !Number.isFinite(id) || id <= 0) && <p className="empty-state">{t("profile.notFound")}</p>}
                {profile &&
                    <>
                        <LevelBlock rating={profile.rating} level={profile.level} />
                        <hr />
                        <h2 className="section-title">{t("profile.badges")}<span className="section-title__count">({profile.badges.length})</span></h2>
                        <BadgesBlock badges={profile.badges} catalogue={catalogue} />
                        <hr />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                            <h2 className="section-title">{t("profile.stats")}</h2>
                            <Link to={toKeepSearch("/leaderboard")} style={{ fontSize: 14 }}>{t("profile.leaderboardLink")}</Link>
                        </div>
                        <ProfileStats stats={profile.stats} />
                    </>
                }
            </div>
        </>
    );
});

export default UserProfilePanel;
