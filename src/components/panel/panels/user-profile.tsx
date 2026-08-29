import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link, useParams } from "react-router-dom";
import panelStore from "../../../store/panel";
import user from "../../../store/user";
import notificationsStore from "../../../store/notifications";
import UsersService, { UserProfile } from "../../../services/UsersService";
import { ApiError } from "../../../services/http";
import { BadgesBlock, LevelBlock, ProfileStats } from "../../profile/profile-blocks";
import { useBadgeCatalogue } from "../../../utils/badges";
import { localeOf, useT } from "../../../i18n";
import { useToKeepSearch } from "../../../utils/navigation";

/** `/users/:id`: public profile with level, badges and statistics (backend integration/wave-5). */
const UserProfilePanel = observer(function UserProfilePanel() {
    const { t, lang } = useT();
    const params = useParams();
    const toKeepSearch = useToKeepSearch();
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const catalogue = useBadgeCatalogue();

    useEffect(() => {
        if (panelHeaderRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight);
            panelStore.setOpen(true);
        }
    }, [profile]);

    const id = Number(params.id);
    useEffect(() => {
        if (!Number.isFinite(id) || id <= 0) {
            return;
        }
        let ignore = false;
        setIsLoading(true);
        setProfile(null);
        setNotFound(false);
        UsersService.getProfile(id)
            .then((data) => {
                if (!ignore) {
                    setProfile(data.payload);
                }
            })
            .catch((error) => {
                if (ignore) {
                    return;
                }
                if (error instanceof ApiError && error.status === 404) {
                    setNotFound(true);
                    return;
                }
                console.error(error);
                notificationsStore.showError(error, t("profile.publicLoadFailed"));
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
    }, [id]);

    const subtitle = profile
        ? `${t("profile.rating")}: ${profile.rating}${profile.member_since ? ` · ${t("profile.memberSince")} ${new Date(profile.member_since).toLocaleDateString(localeOf(lang))}` : ""}`
        : t("profile.public");

    return (
        <>
            <div ref={panelHeaderRef} className="panel__header" onClick={() => panelStore.toggle()}>
                <p><b>{profile?.username ?? t("profile.public")}</b>{profile && profile.user_id === user.id && ` ${t("common.you")}`}</p>
                <p style={{ fontSize: 12 }}>{subtitle}</p>
            </div>
            <div className="panel__content">
                {isLoading && <p style={{ fontSize: 14 }}>{t("common.loading")}</p>}
                {(notFound || !Number.isFinite(id) || id <= 0) && <p style={{ fontSize: 14 }}>{t("profile.notFound")}</p>}
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
